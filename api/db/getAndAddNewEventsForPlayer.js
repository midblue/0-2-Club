const prep = require('./dbDataPrep')
const db = require('./firebaseClient')
const services = require('../getters/services')
const { gameTitle } = require('../../common/functions').default
const verifyPlayers = require('../updater/verifyPlayers')
const updatePlayersPointsAndPeers = require('./updatePlayersPointsAndPeers')

const logger = require('../scripts/log')
const low = logger('getnewevents', 'gray')
const log = logger('getnewevents', 'white')
const logAdd = logger('getnewevents', 'green')
const logInfo = logger('getnewevents', 'blue')
const logError = logger('getnewevents', 'yellow')

const willLoad = []

module.exports = async function(player, skipOwnerIds = []) {
  if (!player.participatedInEvents)
    // if just a stub, get real player
    player = await db.getPlayer({
      game: player.game,
      id: player.id,
      tag: player.tag,
    })
  if (Array.isArray(player)) return [] // cancel on disambig

  log('looking for new events for', player.tag)

  const playerEventOwnerIds = getOwnerIds(player)
  const newOwnerIds = playerEventOwnerIds.filter(
    id => !skipOwnerIds.find(skipId => skipId === id)
  )

  let stubs = await getMoreEventStubs(
    player,
    skipOwnerIds.length ? newOwnerIds : null
  )

  // filter already queued events
  stubs = stubs.filter(
    s =>
      !willLoad.find(
        w =>
          w.eventSlug === s.eventSlug &&
          w.service === s.service &&
          w.tournamentSlug === s.tournamentSlug
      )
  )
  willLoad.push(...stubs)

  let stubsToBatch = [...stubs]
  const perBatch = 15
  while (stubsToBatch.length) {
    log(
      `batching up to ${perBatch} of ${stubsToBatch.length} remaining new events... (${willLoad.length} total)`
    )
    const currentStubs = stubsToBatch.slice(0, perBatch) // grab a subset
    let newEvents = await loadNewEventsData(currentStubs) // get data
    newEvents = newEvents.filter(e => e && !e.err)
    await saveEvents(newEvents, player.game) // save them fully
    stubsToBatch = stubsToBatch.slice(perBatch) // advance to next set
  }

  // return
  stubs.forEach(s =>
    willLoad.splice(
      willLoad.findIndex(
        w =>
          w.eventSlug === s.eventSlug &&
          w.service === s.service &&
          w.tournamentSlug === s.tournamentSlug
      ),
      1
    )
  )

  return { newOwnerIds }
}

async function saveEvents(newEvents, game) {
  const uniqueParticipants = []

  for (let e of newEvents) {
    uniqueParticipants.push(
      ...e.participants.filter(
        participant =>
          !uniqueParticipants.find(
            player => player.id === participant.id
          )
      )
    )
  }

  let players = await Promise.all(
    uniqueParticipants.map(async p => {
      const foundPlayer = await db.getPlayerById(game, p.id)
      if (foundPlayer) return foundPlayer
      return { id: p.id }
    })
  )

  players = players.filter(
    // weed out doubles (i.e. redirect)
    (p, index) => players.findIndex(p2 => p.id === p2.id) === index
  )

  const updatedPlayers = players.filter(p => p.tag)
  const newPlayers = players.filter(p => !p.tag)

  await Promise.all(
    newEvents.map(async event => {
      await db.addEvent(event)

      let skipDouble = 0

      event.participants.map(participant => {
        const player =
          newPlayers.find(
            p =>
              participant.id === p.redirect || participant.id === p.id
          ) ||
          updatedPlayers.find(
            p =>
              participant.id === p.redirect || participant.id === p.id
          )

        let newPlayerData = {}
        if (!player.tag) {
          newPlayerData = prep.makeNewPlayerToSaveFromEvent(
            event,
            participant
          )
        } else {
          // todo also grab image, tag, etc? (or only if is most recent event for player)
          const newParticipantData = prep.makeParticipantDataToSaveFromEvent(
            event,
            participant
          )
          // todo update instead
          if (
            player.participatedInEvents.find(
              e => e.id === newParticipantData.id
            )
          )
            skipDouble++
          else {
            newPlayerData.participatedInEvents = [
              ...player.participatedInEvents,
              newParticipantData,
            ]
          }
        }
        for (let key of Object.keys(newPlayerData))
          player[key] = newPlayerData[key]
      })
      if (skipDouble)
        logError(
          'skipped double adding participant data for',
          skipDouble,
          `players (event ${event.name} @ ${event.tournamentName})`
        )
    })
  )

  if (updatedPlayers.length + newPlayers.length)
    log(
      `will update ${updatedPlayers.length} and add ${newPlayers.length} players`
    )

  await Promise.all(newPlayers.map(player => db.addPlayer(player))) // to keep counts correct etc
  if (newPlayers.length)
    logAdd(`added ${newPlayers.length} new players`)

  // while we're here, go ahead and do the points for these players
  if (newPlayers.length || updatedPlayers.length) {
    // await verifyPlayers([...newPlayers, ...updatedPlayers]) // probably don't need to do this here tbh
    await updatePlayersPointsAndPeers([
      ...newPlayers,
      ...updatedPlayers,
    ])
  }
}

function getOwnerIds(events) {
  if (!events) return []
  if (events.participatedInEvents)
    events = events.participatedInEvents
  return Array.from(
    new Set(events.map(event => event.ownerId))
  ).filter(id => id)
}

async function getMoreEventStubs(player, ownerIdsToCheck) {
  if (!player) return
  // get all services to check
  const servicesList = player.participatedInEvents.reduce(
    (list, event) => {
      if (!list.find(s => s === event.service))
        return [...list, event.service]
      return list
    },
    []
  )
  // get new event stubs from all services
  const newStubs = await Promise.all(
    servicesList.map(s => {
      return services[s].moreEventsForPlayer(
        player,
        ownerIdsToCheck,
        null, // todo check this to make sure it will work
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

async function loadNewEventsData(eventStubs) {
  const newEvents = await Promise.all(
    eventStubs.map(stub => services[stub.service].event(stub))
  )
  return newEvents
}
