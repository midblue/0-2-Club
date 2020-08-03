const saveEvents = require('../db/saveEvents')
const db = require('../db/firebaseClient')
const services = require('./services')
const { gameTitle } = require('../../common/functions')
const verifyPlayers = require('../updater/verifyPlayers')
const updatePlayersPointsAndPeers = require('../db/updatePlayersPointsAndPeers')

const io = require('../io/io')()

const logger = require('../scripts/log')
const { updatePlayer } = require('../db/firebaseClient')
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

  const maxNewEvents = 50
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
    let remainingStubs = [...stubs]
    let shouldContinue = remainingStubs.length > 0
    if (shouldContinue) {
      let currentStub = remainingStubs.shift()
      log(
        'preloading',
        currentStub.eventSlug,
        currentStub.tournamentSlug,
        `(${remainingStubs.length} left in queue)`,
      )
      let preloadedEventData = services[currentStub.service].event(currentStub)
      let doneSaving

      while (shouldContinue) {
        preloadedEventData = await preloadedEventData // grab preloaded event data
        const loadedEventData = preloadedEventData
        if (loadedEventData && loadedEventData.participants) {
          await doneSaving // previous event is saved
          doneSaving = saveEvents(loadedEventData) // save THIS preloaded event fully

          // don't try to load the next event yet if this one was huge (heap out of memory possible)
          if (loadedEventData.participants.length > 100) await doneSaving
        } else
          logError(
            `skipping event ${currentStub.eventSlug} ${currentStub.tournamentSlug}, bad data`,
          )

        shouldContinue = remainingStubs.length > 0

        // preload next event data
        if (shouldContinue) {
          currentStub = remainingStubs.shift()
          log(
            'preloading',
            currentStub.eventSlug,
            currentStub.tournamentSlug,
            `(${remainingStubs.length} left in queue)`,
          )
          preloadedEventData = services[currentStub.service].event(currentStub)
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

  await updatePlayersPointsAndPeers(player, false, null, true)

  await updatePlayer(
    {
      id: player.id,
      game: player.game,
      lastScanned: parseInt(Date.now() / 1000),
    },
    false,
    true,
  )

  io.to(`${player.game}/${player.id}`).emit('endEventSearch')
  io.to(`${player.game}/${player.tag}`).emit('endEventSearch')

  return { newOwnerIds }
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
