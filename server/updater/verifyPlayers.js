const db = require('../db/firebaseClient')

const logger = require('../scripts/log')
const low = logger('verifyplayers', 'gray')
const log = logger('verifyplayers', 'white')
const logAdd = logger('verifyplayers', 'green')
const logInfo = logger('verifyplayers', 'blue')
const logError = logger('verifyplayers', 'yellow')

module.exports = async function(playerGamesAndIds) {
  // if a player has a ref to an event that doesn't exist, clear it out.
  // if a player is missing key data, ...just announce it for now.
  const updated = []
  const knownMissingEvents = new Set()

  for (let playerStub of playerGamesAndIds) {
    let player = await db.getPlayerById(playerStub.game, playerStub.id) // id actually has a game prop too

    let didUpdate = false

    if (player.redirect) {
      const prevPlayer = player
      player = await db.getPlayerById({
        game: player.game,
        id: player.redirect,
      })
      if (!player || !player.id)
        logError(
          `Redirect player is missing for player ${prevPlayer.tag} (${prevPlayer.id}, redirected to ${prevPlayer.redirect})!`,
        )
    }
    if (!player.tag) {
      logError(`No tag found for player ${player.id}!`)
    }
    if (!player.id) {
      logError(`No id found for player ${player.tag}!`)
    }
    if (!player.game) {
      logError(`No game found for player ${player.id}!`)
    }

    for (let index in player.participatedInEvents) {
      const event = player.participatedInEvents[index]
      let thisEventIsKnownToBeMissing = !!knownMissingEvents.has(
        event.service + event.id + event.game,
      )
      // todo test this
      if (!thisEventIsKnownToBeMissing) {
        if (
          !(await db.getEventExists({
            service: event.service,
            id: event.id,
            game: player.game,
          }))
        ) {
          thisEventIsKnownToBeMissing = true
          knownMissingEvents.add(event.service + event.id + player.game)
        }
      }
      if (thisEventIsKnownToBeMissing) {
        player.participatedInEvents.splice(index, 1)
        didUpdate = true
      }
    }
    if (didUpdate) {
      updated.push(player)
    }
  }
  if (knownMissingEvents.size)
    logError(
      'Missing events',
      Array.from(knownMissingEvents).join(', '),
      'in db, removed from player histories',
    )

  if (updated.length) {
    low(`will update ${updated.length} players...`)
    await Promise.all(updated.map(p => db.updatePlayer(p)))
    logAdd(`updated ${updated.length} players`)
    return updated
  } else
    low(`${playerGamesAndIds.length} players' data seems complete and accurate`)
}
