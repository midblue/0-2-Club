const db = require('../db/firebaseClient')
const get = require('../getters/get')

const logger = require('../scripts/log')
const low = logger('verifyevents', 'gray')
const log = logger('verifyevents', 'white')
const logAdd = logger('verifyevents', 'green')
const logInfo = logger('verifyevents', 'blue')
const logError = logger('verifyevents', 'yellow')

module.exports = async function(events) {
  if (!events || !events.length) return []
  const relevantPlayerGamesAndIds = [] // ! this is a little funky tbh
  const toFix = await checkForAccuracy(events, relevantPlayerGamesAndIds)
  if (toFix.length) {
    logError('Found error in data for', toFix.length, 'event/s, resolving...')
    await fixEventDataErrors(toFix)
  } else
    low(
      events.length,
      `events' data starting with`,
      events[0].tournamentName,
      'seems complete and accurate',
    )
  return relevantPlayerGamesAndIds
}

async function checkForAccuracy(events, relevantPlayerGamesAndIds) {
  const eventsToDeleteAndReAdd = []
  for (let event of events) {
    eventsToDeleteAndReAdd.push(
      await checkSingleEvent(event, relevantPlayerGamesAndIds),
    )
  }
  return eventsToDeleteAndReAdd.filter(e => e)
}

async function checkSingleEvent(event, relevantPlayerGamesAndIds) {
  let missingEventsForPlayerCount = 0,
    missingPlayersCount = 0
  await Promise.all(
    event.participants.map(async participant => {
      const player = await db.getPlayerById(event.game, participant.id)
      if (!player) {
        logError('Missing player', participant.tag, participant.id)
        missingPlayersCount++
        return
      }
      if (
        !relevantPlayerGamesAndIds.find(
          p => p.id === player.id && p.game === player.game,
        )
      )
        relevantPlayerGamesAndIds.push({ id: player.id, game: player.game })
      const playerInEvent = (player.participatedInEvents || []).find(
        e => e.id === event.id,
      )
      if (!playerInEvent && !player.redirect) {
        missingEventsForPlayerCount++
      }
    }),
  )
  if (missingEventsForPlayerCount > 0 || missingPlayersCount > 0) {
    logError(
      'Missing event',
      event.tournamentName,
      event.id,
      event.service,
      'entry for',
      missingEventsForPlayerCount,
      'players, and missing',
      missingPlayersCount,
      'players in event.',
    )
    return event
  }
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

    // log('deleted event', event.name, event.tournamentName)
  }

  low(
    'will remove entry from',
    Object.keys(affectedPlayers).length,
    'players...',
  )

  let updatedPlayersNum = 0
  const nonexistantPlayers = []
  await Promise.all(
    Object.keys(affectedPlayers).map(async id => {
      return new Promise(async resolve => {
        const player = await db.getPlayerById(affectedPlayers[id][0].game, id)
        if (!player) {
          log('no player found for', affectedPlayers[id][0].game, id)
          nonexistantPlayers.push(id)
          return resolve()
        }
        updatedPlayersNum++
        const participatedInEvents = (player.participatedInEvents || []).filter(
          e => !affectedPlayers[id].find(stub => stub.id === e.id),
        )
        player.participatedInEvents = participatedInEvents
        await db.updatePlayer(player)
        resolve()
      })
    }),
  )
  if (nonexistantPlayers.length)
    logError(
      'attempted to fix',
      nonexistantPlayers.length,
      'players that do not exist. Will add',
      nonexistantPlayers.join(', '),
    )

  log('deleted record of event/s from', updatedPlayersNum, 'players')

  low(`readding ${eventsToDeleteAndReAdd.length} event/s...`)

  for (let event of eventsToDeleteAndReAdd) {
    await get.event({
      service: event.service,
      eventSlug: event.eventSlug,
      tournamentSlug: event.tournamentSlug,
      game: event.game,
      // onlyUpdatePlayers: true,
    })
  }
}
