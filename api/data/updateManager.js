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

module.exports = {
  addEventWithNoContext,
}

const aDayInSeconds = 24 * 60 * 60
let games = []

// setInterval(daily, 24 * 60 * 60 * 1000)
// setTimeout(daily, 5000)
// daily()

setTimeout(async () => {
  // console.log(await db.getStats())
  await require('./get').event({
    service: 'smashgg',
    slug: 'dx-melee-singles-1-vs-1',
    tournamentSlug: 'battlegateway-29-1',
    game: 'Super Smash Bros. Melee',
  })
  await require('./get').event({
    service: 'smashgg',
    slug: 'melee-singles-vs',
    tournamentSlug: 'battlegateway-26',
    game: 'Super Smash Bros. Melee',
  })
}, 5000)
// user 640241

function daily() {
  logInfo('starting daily full update')
  // todo if there are many games, only do a few per day
  return new Promise(async resolve => {
    games = await db.getGames()

    for (let game of games) {
      const allPlayers = await db.getPlayers(game)
      const activeCutoff = Date.now() / 1000 - 14 * aDayInSeconds
      const activePlayers = allPlayers.filter(
        p => p.lastActive > activeCutoff
      )
      const passivePlayers = allPlayers.filter(
        p => !p.lastActive || p.lastActive <= activeCutoff
      )
      const allEvents = await db.getEvents(game)
      logInfo(
        `${activePlayers.length} active and ${passivePlayers.length} passive players found in ${allEvents.length} events for game ${game}`
      )
      db.setStat(`players ${game}`, allPlayers.length)
      db.setStat(`events ${game}`, allEvents.length)

      // get new event info for all active players
      const alreadyCheckedOwnerIds = []
      const eventPromises = await Promise.all(
        activePlayers.map(async player => {
          const {
            newOwnerIds,
            newPlayers,
          } = await findAndSaveNewEventsForPlayer(
            player,
            alreadyCheckedOwnerIds,
            allEvents,
            allPlayers
          )
          alreadyCheckedOwnerIds.push(newOwnerIds)
          return newPlayers
        })
      )
      const newUnsavedPlayers = [].concat.apply([], eventPromises)
      allPlayers.push(...newUnsavedPlayers)
      ;(newUnsavedPlayers.length > 0 ? log : low)(
        `${newUnsavedPlayers.length} new players found for ${game}`
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

      if (newUnsavedPlayers.length + playersToUpdate.length > 0) {
        log(
          `saving data for ${newUnsavedPlayers.length +
            playersToUpdate.length} player/s...`
        )
        // todo might be simpler to just add all here, we have the newest data anyway
        await Promise.all(newUnsavedPlayers.map(p => db.addPlayer(p)))
        await Promise.all(
          playersToUpdate.map(p => db.updatePlayer(p))
        )
        logAdd(
          `saved data for ${newUnsavedPlayers.length +
            playersToUpdate.length} player/s`
        )
      } else low(`no new player data to save`)

      resolve()
    }
  })
}

async function saveNewEventsToDb(events) {
  const savePromises = events.map(db.addEvent)
  await Promise.all(savePromises)
  return
}

async function findAndSaveNewEventsForPlayer(
  player,
  skipOwnerIds = [],
  allEvents,
  allPlayers
) {
  const playerEventOwnerIds = getOwnerIds(player)
  const newOwnerIds = playerEventOwnerIds.filter(
    id => !skipOwnerIds.find(skipId => skipId === id)
  )
  // low(
  //   `${newOwnerIds.length} owner/s found related to player ${player.tag}`
  // )

  const stubs = await getMoreEventStubs(
    player,
    newOwnerIds,
    allEvents
  )

  let newEvents = await loadNewEvents(stubs)
  let newPlayers = []

  if (newEvents && newEvents.length > 0) {
    newEvents = newEvents.filter(newEvent => {
      !allEvents.find(
        e => e.id === newEvent.id && e.service === newEvent.service
      )
    })
    allEvents.push(...newEvents)

    for (let e of newEvents) {
      await db.saveEvent(e)
      e.participants.forEach(p => {
        const existingPlayer = allPlayers.find(
          existingPlayer => existingPlayer.id === p.id
        )
        if (!existingPlayer)
          newPlayers.push(prep.makeNewPlayerToSaveFromEvent(e, p))
        else
          existingPlayer.participatedInEvents.push(
            prep.makeParticipantDataToSaveFromEvent(e, p)
          )
      })
    }
  }
  return { newOwnerIds, newPlayers }
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
        allEvents
      )
    })
  )
  const eventStubs = [].concat.apply([], newStubs || [])
  if (eventStubs.length > 0)
    log(
      `${eventStubs.length} new event/s found for ${
        player.tag
      } on ${servicesList.join(' and ')}`
    )
  return eventStubs
}

async function loadNewEvents(eventStubs) {
  const eventData = eventStubs.map(stub => {
    services[stub.service].event(stub)
  })
  await Promise.all(eventData)
  return eventData
}

async function recalculatePoints(player, allPlayers) {
  return new Promise(async resolve => {
    const startingPointsLength = player.points.length
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
    event.participants.forEach(({ id, tag }) => {
      if (tag !== player.tag)
        idsByFrequency[id] = {
          tag,
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

async function addEventWithNoContext(event) {
  // get players or lack thereof from db
  let players = await Promise.all(
    event.participants.map(async participant => {
      const playerData = await db.getPlayer({
        game: event.game,
        id: participant.id,
      })
      return {
        participant,
        ...playerData,
      }
    })
  )

  // make full player data out of participants
  players = players.map(p => {
    if (!p.tag)
      // is new
      return prep.makeNewPlayerToSaveFromEvent(event, p.participant)
    else {
      const updatedPlayerData = {
        ...p,
        participatedInEvents: [
          ...p.participatedInEvents,
          prep.makeParticipantDataToSaveFromEvent(
            event,
            p.participant
          ),
        ],
      }
      delete updatedPlayerData.participant
      return updatedPlayerData
    }
  })

  // calculate points, as far as possible
  // * without access to All Players, only opponent points from THIS event are possible... so we only calculate ones from this event. the rest will be handled by the daily sweep.
  const playersWithPoints = await Promise.all(
    players.map(async player => {
      let newPoints = await points.get(player, players, event.id)
      return {
        ...player,
        points: [...player.points, ...newPoints],
      }
    })
  )
  // low(`updating ${playersWithPoints.length} players...`)

  // * no peers for now, that'll also be handled in the daily sweep. if they already had them, they stay the same for now.

  // save all
  db.addEvent(event)
  await Promise.all([
    ...playersWithPoints
      .filter(p => p.participatedInEvents.length <= 1)
      .map(player => db.addPlayer(player)),
    ...playersWithPoints
      .filter(p => p.participatedInEvents.length > 1)
      .map(player => db.updatePlayer(player)),
  ])
  log(
    `done saving all data for ${event.slug} @ ${event.tournamentSlug}`
  )
}
