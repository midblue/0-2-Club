const services = require('./services')
const points = require('./points/points')
const db = require('./firebaseClient')
const prep = require('./dbDataPrep')

const logger = require('./scripts/log')
const low = logger('updater', 'gray')
const log = logger('updater', 'white')
const logAdd = logger('updater', 'green')
const logInfo = logger('updater', 'blue')
const logError = logger('updater', 'yellow')

const { gameTitle } = require('../../common/f').default

module.exports = {
  addEventWithNoContext,
  combinePlayers,
  daily,
}

const aDayInSeconds = 24 * 60 * 60
const aDayInMilliseconds = aDayInSeconds * 1000
let games = []

// setInterval(daily, aDayInMilliseconds)

// user 640241

function daily() {
  logInfo('starting daily full update')
  // todo if there are many games, only do a few per day
  return new Promise(async resolve => {
    games = await db.getGames()

    for (let game of games) {
      // todo if there are players that need regenerating, might want to have a list in the DB for that (and code here to regen that player)
      // todo manually delete event/s from db

      let allPlayers = await db.getPlayers(gameTitle(game))
      const activeCutoff = Date.now() / 1000 - 14 * aDayInSeconds
      const activePlayers = allPlayers.filter(
        p => p.lastActive > activeCutoff
      )
      const passivePlayers = allPlayers.filter(
        p => !p.lastActive || p.lastActive <= activeCutoff
      )
      const allEvents = await db.getEvents(gameTitle(game))
      logInfo(
        `${activePlayers.length} active and ${
          passivePlayers.length
        } passive players found in ${
          allEvents.length
        } events for game ${gameTitle(game)}`
      )

      // check for accuracy — all players that should have event data do, and vice versa
      const inaccurateEvents = await checkForAccuracy(
        allPlayers,
        allEvents
      )
      const toFix = []
      inaccurateEvents.forEach(e => {
        if (
          !toFix.find(
            known =>
              known.service === e.service &&
              known.eventSlug === e.eventSlug &&
              known.tournamentSlug === e.tournamentSlug &&
              known.game === e.game
          )
        )
          toFix.push(e)
      })
      if (toFix.length) {
        logError(
          'Found error in data for',
          toFix.length,
          'events, resolving...'
        )
        fixDataErrors(toFix, allEvents, allPlayers)
      } else
        low('event data for', game, 'seems complete and accurate')

      const playersWithFixedErroneousData = fixPlayersWithBrokenEventStubs(
        allEvents,
        allPlayers
      )
      if (playersWithFixedErroneousData.length) {
        logError(
          'Found and removed event references to missing events in data for',
          playersWithFixedErroneousData.length,
          'players'
        )
      } else
        low('player data for', game, 'seems complete and accurate')

      allPlayers = allPlayers.filter(p => !p.redirect)

      // get new event info for all active players
      const alreadyCheckedOwnerIds = []
      const newUnsavedPlayers = []
      const newUnsavedEvents = []
      for (let player of activePlayers) {
        const memory = process.memoryUsage()
        const memoryUsedPercent = memory.heapUsed / memory.rss
        if (memoryUsedPercent > 0.85) {
          logError(
            'Low on memory, aborting remaining player updates. Will likely get to them on next daily.',
            Math.round(memory.heapUsed / 1024 / 1024),
            'mb of',
            Math.round(memory.rss / 1024 / 1024),
            'mb'
          )
          break
        }
        const {
          newOwnerIds,
          newPlayers,
          newEvents,
        } = await getNewEventsForPlayer(
          player,
          alreadyCheckedOwnerIds,
          allEvents,
          allPlayers
        )
        alreadyCheckedOwnerIds.push(...newOwnerIds)
        newUnsavedPlayers.push(...newPlayers)
        newUnsavedEvents.push(...newEvents)
      }

      if (newUnsavedEvents.length)
        logInfo(
          `${
            newUnsavedEvents.length
          } new events found for game ${gameTitle(game)}`
        )
      ;(newUnsavedPlayers.length > 0 ? log : low)(
        `${
          newUnsavedPlayers.length
        } new players found for ${gameTitle(game)}`
      )

      // at this point all new events are saved into the db AND exist nicely in our allEvents object,
      // and all new players are in allPlayers, unsaved.

      // then, get points for all players
      let playersWithUnsavedUpdatedPoints = await Promise.all(
        allPlayers.map(player =>
          recalculatePoints(player, allPlayers)
        )
      )
      playersWithUnsavedUpdatedPoints = playersWithUnsavedUpdatedPoints.filter(
        p => p
      )
      ;(playersWithUnsavedUpdatedPoints.length > 0 ? log : low)(
        `will update points for ${playersWithUnsavedUpdatedPoints.length} player/s`
      )
      // at this point, all players in allPlayers have updated points.

      // then, get peers for all players
      let playersWithUnsavedUpdatedPeers = await Promise.all(
        allPlayers.map(player => recalculatePeers(player, allEvents))
      )
      playersWithUnsavedUpdatedPeers = playersWithUnsavedUpdatedPeers.filter(
        p => p
      )
      ;(playersWithUnsavedUpdatedPeers.length > 0 ? log : low)(
        `will update peers for ${playersWithUnsavedUpdatedPeers.length} player/s`
      )
      // at this point, all players in allPlayers have updated peers and points.

      // then, save all updated players
      const playersToUpdate = playersWithUnsavedUpdatedPeers
      playersWithUnsavedUpdatedPoints.forEach(mightUpdate => {
        if (
          !playersToUpdate.find(
            alreadySaving => mightUpdate.id === alreadySaving.id
          )
        )
          playersToUpdate.push(mightUpdate)
      })
      playersWithFixedErroneousData.forEach(mightUpdate => {
        if (
          !playersToUpdate.find(
            alreadySaving => mightUpdate.id === alreadySaving.id
          )
        )
          playersToUpdate.push(mightUpdate)
      })

      if (newUnsavedPlayers.length + playersToUpdate.length > 0) {
        low(
          `saving data for ${newUnsavedPlayers.length +
            playersToUpdate.length} player/s...`
        )
        await Promise.all(newUnsavedPlayers.map(p => db.addPlayer(p)))
        await Promise.all(
          playersToUpdate.map(p => db.updatePlayer(p))
        )
        logAdd(
          `saved data for ${newUnsavedPlayers.length +
            playersToUpdate.length} player/s`
        )
      } else low(`no new player data to save`)

      // then, save all new events (done here to avoid a half-updated db if it hangs mid-daily)
      if (newUnsavedEvents.length > 0) {
        low(`saving data for ${newUnsavedEvents.length} event/s...`)
        await Promise.all(newUnsavedEvents.map(e => db.addEvent(e)))
        logAdd(`saved data for ${newUnsavedEvents.length} event/s`)
      } else low(`no new event data to save`)

      db.setStat(
        `playerCounts.${encodeURIComponent(gameTitle(game)).replace(
          /\./g,
          '+'
        )}`,
        allPlayers.length + newUnsavedPlayers.length
      )
      db.setStat(
        `eventCounts.${encodeURIComponent(gameTitle(game)).replace(
          /\./g,
          '+'
        )}`,
        allEvents.length + newUnsavedEvents.length
      )
    }

    logInfo(`daily full update complete!`)
    resolve()
  })
}

// check for accuracy — all players that should have event data do, and vice versa
async function checkForAccuracy(allPlayers, allEvents) {
  const eventsToDeleteAndReAdd = []
  for (let event of allEvents) {
    for (let participant of event.participants) {
      const player = allPlayers.find(p => p.id === participant.id)
      if (!player) {
        logError('Missing player', participant.tag, participant.id)
        eventsToDeleteAndReAdd.push({
          game: event.game,
          id: event.id,
          eventSlug: event.slug,
          tournamentSlug: event.tournamentSlug,
          service: event.service,
        })
        return
      }
      const playerInEvent = (player.participatedInEvents || []).find(
        e => e.id === event.id
      )
      if (!playerInEvent && !player.redirect) {
        logError(
          'Missing event',
          event.tournamentName,
          event.id,
          event.service,
          'entry for',
          participant.tag,
          participant.id
        )
        eventsToDeleteAndReAdd.push({
          game: event.game,
          id: event.id,
          eventSlug: event.slug,
          tournamentSlug: event.tournamentSlug,
          service: event.service,
        })
      }
    }
  }

  return eventsToDeleteAndReAdd
}

function fixPlayersWithBrokenEventStubs(allEvents, allPlayers) {
  // if a player has a ref to an event that doesn't exist, clear it out.
  const updated = []
  for (let player of allPlayers) {
    let didUpdate = false
    for (let index in player.participatedInEvents)
      if (
        !allEvents.find(
          e => e.id === player.participatedInEvents[index].id
        )
      ) {
        player.participatedInEvents.splice(index, 1)
        didUpdate = true
      }
    if (didUpdate) {
      updated.push(player)
      db.addPlayer(player)
    }
  }
  return updated
}

async function fixDataErrors(toFix, allEvents, allPlayers) {
  const affectedPlayers = {}
  for (let eventStub of toFix) {
    const event = allEvents.find(
      e => e.id === eventStub.id && e.service === eventStub.service
    )
    db.deleteEvent(event.id, event.service, event.game)
    for (let player of event.participants) {
      if (!affectedPlayers[player.id]) affectedPlayers[player.id] = []
      affectedPlayers[player.id].push(event.id)
    }
    const index = allEvents.findIndex(
      e => e.id === eventStub.id && e.service === eventStub.service
    )
    allEvents.splice(index, 1)
    log('deleted event', event.name, event.tournamentName)
  }
  let updatedPlayersNum = 0
  // todo doesn't work?
  for (let id of Object.keys(affectedPlayers)) {
    const player = allPlayers.find(e => e.id === id)
    if (!player) continue
    updatedPlayersNum++
    const participatedInEvents = (
      player.participatedInEvents || []
    ).filter(e => !affectedPlayers[id].find(id => id === e.id))
    player.participatedInEvents = participatedInEvents
    db.addPlayer(player)
  }
  log('deleted record of event', 'from', updatedPlayersNum, 'players')
}

async function getNewEventsForPlayer(
  player,
  skipOwnerIds = [],
  allEvents,
  allPlayers
) {
  const playerEventOwnerIds = getOwnerIds(player)
  const newOwnerIds = playerEventOwnerIds.filter(
    id => !skipOwnerIds.find(skipId => skipId === id)
  )
  if (newOwnerIds.length)
    low(
      `${newOwnerIds.length} new owner/s found related to player ${
        player.tag
      } (${playerEventOwnerIds.length -
        newOwnerIds.length} skipped) (${Math.round(
        (process.memoryUsage().heapUsed / process.memoryUsage().rss) *
          100
      )}% heap)`
    )

  let stubs = await getMoreEventStubs(player, newOwnerIds, allEvents)

  let newEvents = await loadNewEvents(stubs)
  newEvents = newEvents.filter(e => e)
  let newPlayers = []

  if (newEvents && newEvents.length > 0) {
    newEvents = newEvents.filter(
      newEvent =>
        newEvent &&
        !allEvents.find(
          e => e.id === newEvent.id && e.service === newEvent.service
        )
    )
    allEvents.push(...newEvents)

    for (let e of newEvents) {
      e.participants.forEach(p => {
        const existingPlayer = allPlayers.find(ep => ep.id === p.id)
        if (!existingPlayer) {
          const newPlayer = prep.makeNewPlayerToSaveFromEvent(e, p)
          newPlayers.push(newPlayer)
          allPlayers.push(newPlayer)
        } else {
          const newParticipantData = prep.makeParticipantDataToSaveFromEvent(
            e,
            p
          )
          if (
            existingPlayer.participatedInEvents.find(
              e => e.id === newParticipantData.id
            )
          )
            logError(
              'skipped double adding participant data for',
              existingPlayer.tag,
              `(event ${newParticipantData.name} @ ${newParticipantData.tournamentName})`
            )
          else
            existingPlayer.participatedInEvents.push(
              newParticipantData
            )
        }
      })
    }
  }
  return { newOwnerIds, newPlayers, newEvents }
}

function getOwnerIds(events) {
  if (!events) return []
  if (events.participatedInEvents)
    events = events.participatedInEvents
  return Array.from(
    new Set(events.map(event => event.ownerId))
  ).filter(id => id)
}

async function getMoreEventStubs(player, ownerIdsToCheck, allEvents) {
  if (!player) return
  const servicesList = player.participatedInEvents.reduce(
    (list, event) => {
      if (!list.find(s => s === event.service))
        return [...list, event.service]
      return list
    },
    []
  )
  const newStubs = await Promise.all(
    servicesList.map(s => {
      return services[s].moreEventsForPlayer(
        player,
        ownerIdsToCheck,
        allEvents,
        gameTitle(player.game)
      )
    })
  )
  const eventStubs = [].concat.apply([], newStubs || [])
  if (eventStubs.length > 0)
    log(
      `${eventStubs.length} usable new event/s found for ${
        player.tag
      } on ${servicesList.join(' and ')}`
    )
  return eventStubs
}

async function loadNewEvents(eventStubs) {
  const newEvents = await Promise.all(
    eventStubs.map(stub => services[stub.service].event(stub))
  )
  return newEvents
}

async function recalculatePoints(player, allPlayers) {
  return new Promise(async resolve => {
    const startingPointsLength = (player.points || []).length
    player.points = await points.get(player, allPlayers)
    const wereNewPoints =
      startingPointsLength !== player.points.length
    // todo more robust wereNewPoints check
    resolve(wereNewPoints ? player : null)
  })
}

async function recalculatePeers(player, allEvents) {
  // todo? make this based on avg % overlap over all events for both players, not just raw numbers
  const startingPeers = player.peers || []
  const idsByFrequency = {}
  player.participatedInEvents.map(partialEvent => {
    const event = allEvents.find(
      e =>
        e.id === partialEvent.id && e.service === partialEvent.service
    )
    if (!event || !event.participants) return
    event.participants.forEach(({ id, tag, img }) => {
      if (tag !== player.tag)
        idsByFrequency[id] = {
          tag,
          img,
          common:
            (idsByFrequency[id] ? idsByFrequency[id].common : 0) + 1,
        }
    })
  })
  const peers = Object.keys(idsByFrequency)
    .filter(id => idsByFrequency[id].common > 2)
    .sort(
      (a, b) => idsByFrequency[b].common - idsByFrequency[a].common
    )
    .slice(0, 10)
    .map(id => ({
      id,
      ...idsByFrequency[id],
    }))

  const peersDidUpdate =
    (!startingPeers.length && peers.length > 0) ||
    startingPeers.length !== peers.length ||
    peers.reduce((didUpdate, newPeer, index) => {
      return didUpdate || startingPeers[index].id !== newPeer.id
    }, false)
  if (peersDidUpdate) {
    player.peers = peers
    return player
  }
  return
}

async function combinePlayers({ game, tag, id }) {
  if (!game || !id || !tag)
    return logError(
      'unable to combine players!',
      gameTitle(game),
      id,
      tag
    )
  const playersToCombine = await db.getPlayerByTag(
    gameTitle(game),
    tag
  )
  if (
    !playersToCombine ||
    !Array.isArray(playersToCombine) ||
    playersToCombine.length < 2
  )
    return logError(
      'unable to combine players — appears to be too few to combine',
      playersToCombine
    )
  const masterPlayer = playersToCombine.find(p => p.id === id)
  const subPlayers = playersToCombine.filter(p => p.id !== id)
  if (!masterPlayer)
    return logError(
      `unable to combine players — can't find a player by the tag`,
      tag,
      `with id`,
      id
    )

  subPlayers.forEach(subPlayer => {
    masterPlayer.participatedInEvents.push(
      ...subPlayer.participatedInEvents
    )
    masterPlayer.points.push(...subPlayer.points)
    subPlayer.redirect = id
    delete subPlayer.lastActive
    delete subPlayer.lastUpdated
    delete subPlayer.participatedInEvents
    delete subPlayer.peers
    delete subPlayer.points
  })
  masterPlayer.lastActive = Date.now() / 1000
  await Promise.all(
    playersToCombine.map(player => db.addPlayer(player))
  )
}

let loadedPlayers = {},
  clearLoadedPlayers = null

async function addEventWithNoContext(event) {
  clearTimeout(clearLoadedPlayers)

  // load players or lack thereof from db and place in-memory
  let players = await Promise.all(
    event.participants.map(async participantData => {
      let fromDb = null
      if (!loadedPlayers[participantData.id])
        fromDb = await db.getPlayer({
          game: gameTitle(event.game),
          id: participantData.id,
        })

      // check for redirect
      if (fromDb && fromDb.redirect)
        fromDb = await db.getPlayer({
          game: gameTitle(event.game),
          id: fromDb.redirect,
        })

      if (
        !loadedPlayers[participantData.id] &&
        (!fromDb || !fromDb.error)
      )
        loadedPlayers[participantData.id] = fromDb || {}

      loadedPlayers[participantData.id][
        'participantData' + event.id
      ] = participantData
      return loadedPlayers[participantData.id]
    })
  )
  if (players.find(p => !p)) {
    return logError(
      `Failed to add event ${event.name} @ ${event.tournamentName}, firebase error (likely quota)`
    )
  }
  clearTimeout(clearLoadedPlayers)

  // make full player data out of participants
  players = players.map(p => {
    if (!p.id) {
      // is new
      p = prep.makeNewPlayerToSaveFromEvent(
        event,
        p['participantData' + event.id]
      )
      loadedPlayers[p.id] = p
    } else {
      const eventParticipantData = prep.makeParticipantDataToSaveFromEvent(
        event,
        p['participantData' + event.id]
      )
      if (!loadedPlayers[p.id].participatedInEvents) {
        logError(
          `should have participatedInEvents but don't for`,
          loadedPlayers[p.id].tag,
          loadedPlayers[p.id].id,
          loadedPlayers[p.id]
        )
      }
      loadedPlayers[p.id].participatedInEvents.push(
        eventParticipantData
      )
    }
    delete loadedPlayers[p.id]['participantData' + event.id]
    return loadedPlayers[p.id]
  })
  clearTimeout(clearLoadedPlayers)

  // calculate points, as far as possible
  // * without access to All Players, only opponent points from THIS event are possible... so we only calculate ones from this event. the rest will be handled by the daily sweep.
  await Promise.all(
    players.map(async player => {
      let newPoints = await points.get(player, players, event.id)
      player.points.push(...newPoints)
    })
  )
  clearTimeout(clearLoadedPlayers)

  // * no peers for now, that'll also be handled in the daily sweep. if they already had them, they stay the same for now.

  await Promise.all([
    db.addEvent(event),
    ...players
      .filter(
        p => loadedPlayers[p.id].participatedInEvents.length <= 1
      )
      .map(p => db.addPlayer(loadedPlayers[p.id])),
    ...players
      .filter(
        p => loadedPlayers[p.id].participatedInEvents.length > 1
      )
      .map(p => db.updatePlayer(loadedPlayers[p.id])),
  ])
  logAdd(
    `done saving ${players.length} players' data for ${event.slug} @ ${event.tournamentSlug}`
  )

  clearTimeout(clearLoadedPlayers)
  clearLoadedPlayers = setTimeout(() => (loadedPlayers = {}), 600000)
}
