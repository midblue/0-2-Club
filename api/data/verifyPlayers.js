const db = require('./firebaseClient')

const logger = require('./scripts/log')
const low = logger('verifyplayers', 'gray')
const log = logger('verifyplayers', 'white')
const logAdd = logger('verifyplayers', 'green')
const logInfo = logger('verifyplayers', 'blue')
const logError = logger('verifyplayers', 'yellow')

module.exports = async function(players) {
  // if a player has a ref to an event that doesn't exist, clear it out.
  const updated = []
  const knownMissing = []

  for (let player of players) {
    let didUpdate = false

    // todo check for basics like missing tag, etc?
    for (let index in player.participatedInEvents) {
      const event = player.participatedInEvents[index]
      const known = knownMissing.find(
        e =>
          e.service === event.service &&
          e.id === event.id &&
          e.game === event.game
      )
      let exists
      if (!known)
        exists = await db.getEventExists({
          service: event.service,
          id: event.id,
          game: player.game,
        })
      if (known || !exists) {
        logError(
          'Missing event',
          event.tournamentName,
          event.id,
          event.service,
          'in db. Found through',
          player.tag,
          player.id
        )
        player.participatedInEvents.splice(index, 1)
        knownMissing.push({
          service: event.service,
          id: event.id,
          game: player.game,
        })
        didUpdate = true
      }
    }
    if (didUpdate) {
      updated.push(player)
    }
  }
  if (updated.length) {
    low(`will update ${updated.length} players...`)
    await Promise.all(updated.map(p => db.updatePlayer(p)))
    logAdd(`updated ${updated.length} players`)
  } else
    low(`${players.length} players' data seems complete and accurate`)
}
