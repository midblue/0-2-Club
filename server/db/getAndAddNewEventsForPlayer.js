const prep = require('./dbDataPrep')
const db = require('./firebaseClient')
const services = require('../getters/services')
const { gameTitle } = require('../../common/functions')
const verifyPlayers = require('../updater/verifyPlayers')
const updateSinglePlayerPointsAndPeers = require('./updateSinglePlayerPointsAndPeers')
const updatePlayersPointsAndPeers = require('./updatePlayersPointsAndPeers')

const io = require('../io/io')()

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

  io.to(`${player.game}/${player.id}`).emit('startEventSearch')
  io.to(`${player.game}/${player.tag}`).emit('startEventSearch')
  log('looking for new events for', player.tag)

  io.to(`${player.game}/${player.id}`).emit(
    'notification',
    'Checking for potential new events...',
  )
  io.to(`${player.game}/${player.tag}`).emit(
    'notification',
    'Checking for potential new events...',
  )
  const newOwnerIds = getOwnerIds(player, skipOwnerIds)

  const maxNewEvents = 30
  let stubs = (
    await getMoreEventStubs(player, skipOwnerIds.length ? newOwnerIds : null)
  ).slice(0, maxNewEvents)
  let allStubsLength = stubs.length

  if (stubs.length)
    io.to(`${player.game}/${player.id}`).emit(
      'notification',
      `<span>Found ${stubs.length} events that you <i>might</i> be in.</span>`,
    )
  io.to(`${player.game}/${player.tag}`).emit(
    'notification',
    `<span>Found ${stubs.length} events that you <i>might</i> be in.</span>`,
  )

  // filter already queued events
  stubs = stubs.filter(
    s =>
      !willLoad.find(
        w =>
          w.eventSlug === s.eventSlug &&
          w.service === s.service &&
          w.tournamentSlug === s.tournamentSlug,
      ),
  )
  willLoad.push(...stubs)
  if (stubs.length !== allStubsLength)
    logError(
      'skipping',
      allStubsLength - stubs.length,
      'events that are already being loaded',
    )

  if (stubs.length) {
    // ! this is faster, but has serious race condition potential.... can't do it this way.
    // await Promise.all(
    //   stubs.map(async stub => {
    //     let loadedEventData = await services[stub.service].event(stub)
    //     log('loading', stub.eventSlug, stub.tournamentSlug)
    // 		await saveEvents([loadedEventData], player.game) // save event fully
    //     io.to(`${player.game}`).emit('newEvents', [loadedEventData])
    //   }),
    // )

    let remainingStubs = [...stubs]
    let shouldContinue = remainingStubs.length > 0
    if (shouldContinue) {
      let currentStub = remainingStubs.shift()
      let preloadedEventData = services[currentStub.service].event(currentStub)
      let doneSaving

      while (shouldContinue) {
        // grab preloaded event data
        preloadedEventData = await preloadedEventData
        const loadedEventData = preloadedEventData
        await doneSaving // previous event is saved
        doneSaving = saveEvents([loadedEventData], player.game) // save event fully
          .then(() =>
            io.to(`${player.game}`).emit('newEvents', [loadedEventData]),
          )

        shouldContinue = remainingStubs.length > 0

        // preload next event data
        if (shouldContinue) {
          currentStub = remainingStubs.shift()
          preloadedEventData = services[currentStub.service].event(currentStub)
          log(
            'preloading',
            currentStub.eventSlug,
            currentStub.tournamentSlug,
            `(${remainingStubs.length} left in queue)`,
          )
        } else await doneSaving
      }
    }

    stubs.forEach(s =>
      willLoad.splice(
        willLoad.findIndex(
          w =>
            w.eventSlug === s.eventSlug &&
            w.service === s.service &&
            w.tournamentSlug === s.tournamentSlug,
        ),
        1,
      ),
    )
  } else {
    low('no new events found for', player.tag)
  }
  log('done loading more events for', player.tag)

  await updateSinglePlayerPointsAndPeers(player, true)

  io.to(`${player.game}/${player.id}`).emit('endEventSearch')
  io.to(`${player.game}/${player.tag}`).emit('endEventSearch')

  return { newOwnerIds }
}

async function saveEvents(newEvents, game) {
  const uniqueParticipants = []

  newEvents = newEvents.filter(e => e).filter(e => e.participants)

  for (let e of newEvents) {
    uniqueParticipants.push(
      ...e.participants.filter(
        participant =>
          !uniqueParticipants.find(player => player.id === participant.id),
      ),
    )
  }

  let players = await Promise.all(
    uniqueParticipants.map(async p => {
      const foundPlayer = await db.getPlayerById(game, p.id)
      if (foundPlayer) return foundPlayer
      return { id: p.id }
    }),
  )

  players = players.filter(
    // weed out doubles (i.e. redirect)
    (p, index) => players.findIndex(p2 => p.id === p2.id) === index,
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
            p => participant.id === p.redirect || participant.id === p.id,
          ) ||
          updatedPlayers.find(
            p => participant.id === p.redirect || participant.id === p.id,
          )

        let newPlayerData = {}
        if (!player.tag) {
          newPlayerData = prep.makeNewPlayerToSaveFromEvent(event, participant)
        } else {
          // todo also grab image, tag, etc? (or only if is most recent event for player)
          const newParticipantData = prep.makeParticipantDataToSaveFromEvent(
            event,
            participant,
          )
          // todo update instead
          if (
            player.participatedInEvents.find(
              e => e.id === newParticipantData.id,
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
          `players (event ${event.name} @ ${event.tournamentName})`,
        )
    }),
  )

  if (updatedPlayers.length + newPlayers.length)
    log(
      `will update ${updatedPlayers.length} and add ${newPlayers.length} players`,
    )

  await Promise.all(newPlayers.map(player => db.addPlayer(player))) // to keep counts correct etc
  if (newPlayers.length) logAdd(`added ${newPlayers.length} new players`)

  // while we're here, go ahead and do the BASIC points for these players
  if (newPlayers.length || updatedPlayers.length) {
    // await verifyPlayers([...newPlayers, ...updatedPlayers]) // probably don't need to do this here tbh
    await updatePlayersPointsAndPeers([...newPlayers, ...updatedPlayers], true)
  }
}

function getOwnerIds(events, skipOwnerIds = []) {
  if (!events) return []
  if (events.participatedInEvents) events = events.participatedInEvents
  return Array.from(new Set(events.map(event => event.ownerId)))
    .filter(id => id)
    .filter(id => !skipOwnerIds.find(skipId => skipId === id))
}

async function getMoreEventStubs(player, ownerIdsToCheck) {
  if (!player) return
  // get all services to check
  const servicesList = player.participatedInEvents.reduce((list, event) => {
    if (!list.find(s => s === event.service)) return [...list, event.service]
    return list
  }, [])
  // get new event stubs from all services
  const newStubs = await Promise.all(
    servicesList.map(s => {
      return services[s].moreEventStubsForPlayer(
        player,
        ownerIdsToCheck,
        null, // todo check this to make sure it will work
        gameTitle(player.game),
      )
    }),
  )
  const eventStubs = [].concat.apply([], newStubs || [])
  if (eventStubs.length > 0)
    log(
      `${eventStubs.length} usable new event/s found for ${
        player.tag
      } on ${servicesList.join(' and ')}`,
    )
  return eventStubs
}

async function loadNewEventsData(eventStubs) {
  const newEvents = await Promise.all(
    eventStubs.map(stub => services[stub.service].event(stub)),
  )
  return newEvents
}
