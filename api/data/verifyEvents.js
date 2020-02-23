const db = require('./firebaseClient')
const get = require('./get')

const logger = require('./scripts/log')
const low = logger('verifyevents', 'gray')
const log = logger('verifyevents', 'white')
const logAdd = logger('verifyevents', 'green')
const logInfo = logger('verifyevents', 'blue')
const logError = logger('verifyevents', 'yellow')

module.exports = async function(events) {
  if (!events || !events.length) return []
  const gotPlayers = [] // this is a little funky tbh
  const toFix = await checkForAccuracy(events, gotPlayers)
  if (toFix.length) {
    logError(
      'Found error in data for',
      toFix.length,
      'event/s, resolving...'
    )
    await fixEventDataErrors(toFix, events)
  } else
    low(
      events.length,
      `events' data starting with`,
      events[0].tournamentName,
      'seems complete and accurate'
    )
  return gotPlayers
}

async function checkForAccuracy(events, gotPlayers) {
  const eventsToDeleteAndReAdd = []
  await Promise.all(
    events.map(async event =>
      eventsToDeleteAndReAdd.push(
        await checkSingleEvent(event, gotPlayers)
      )
    )
  )
  return eventsToDeleteAndReAdd.filter(e => e)
}

async function checkSingleEvent(event, gotPlayers) {
  let willDeleteAndReAdd = false
  await Promise.all(
    event.participants.map(async participant => {
      const player = await db.getPlayerById(
        event.game,
        participant.id
      )
      if (!player) {
        logError('Missing player', participant.tag, participant.id)
        willDeleteAndReAdd = true
        return
      }
      if (
        !gotPlayers.find(
          p => p.id === player.id && p.game === player.game
        )
      )
        gotPlayers.push(player)
      const playerInEvent = (player.participatedInEvents || []).find(
        e => e.id === event.id
      )
      // todo batch these
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
        willDeleteAndReAdd = true
      }
    })
  )
  if (willDeleteAndReAdd) return event
}

async function fixEventDataErrors(eventsToDeleteAndReAdd) {
  const affectedPlayers = {}
  for (let event of eventsToDeleteAndReAdd) {
    for (let player of event.participants) {
      if (!affectedPlayers[player.id]) affectedPlayers[player.id] = []
      affectedPlayers[player.id].push({
        id: event.id,
        game: event.game,
        service: event.service,
      })
    }
    db.deleteEvent(event.id, event.service, event.game)

    log('deleted event', event.name, event.tournamentName)
  }

  log(
    'will remove entry from',
    Object.keys(affectedPlayers).length,
    'players...'
  )

  let updatedPlayersNum = 0
  // todo doesn't work? seems to hang on big events with no network at all
  await Promise.all(
    Object.keys(affectedPlayers).map(async id => {
      return new Promise(async resolve => {
        const player = await db.getPlayerById(
          affectedPlayers[id][0].game,
          id
        )
        if (!player) return
        updatedPlayersNum++
        const participatedInEvents = (
          player.participatedInEvents || []
        ).filter(
          e => !affectedPlayers[id].find(stub => stub.id === e.id)
        )
        player.participatedInEvents = participatedInEvents
        await db.updatePlayer(player)
        resolve()
      })
    })
  )

  log('deleted record of event/s from', updatedPlayersNum, 'players')

  log(`readding ${eventsToDeleteAndReAdd.length} event/s...`)

  for (let event of eventsToDeleteAndReAdd) {
    await get.event({
      service: event.service,
      eventSlug: event.eventSlug,
      tournamentSlug: event.tournamentSlug,
      game: event.game,
      onlyUpdatePlayers: true,
    })
  }
}
