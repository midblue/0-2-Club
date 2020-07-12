const db = require('../db/firebaseClient')

const logger = require('../scripts/log')
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
          e.game === event.game,
      )
      let exists
      if (!known)
        exists = await db.getEventExists({
          service: event.service,
          id: event.id,
          game: player.game,
        })
      if (known || !exists) {
        player.participatedInEvents.splice(index, 1)
        didUpdate = true
        if (
          !knownMissing.find(
            km =>
              km.service === event.service &&
              km.id === event.id &&
              km.game === event.game,
          )
        )
          knownMissing.push({
            service: event.service,
            id: event.id,
            game: player.game,
          })
      }
    }
    if (didUpdate) {
      updated.push(player)
    }
  }
  if (knownMissing.length)
    logError(
      'Missing events',
      knownMissing.map(e => e.id).join(', '),
      'in db, removed from player histories',
    )

  if (updated.length) {
    low(`will update ${updated.length} players...`)
    await Promise.all(updated.map(p => db.updatePlayer(p)))
    logAdd(`updated ${updated.length} players`)
    return updated
  } else low(`${players.length} players' data seems complete and accurate`)
}
