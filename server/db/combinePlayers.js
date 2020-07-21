const db = require('./firebaseClient')
const { gameTitle } = require('../../common/functions')

const logger = require('../scripts/log')
const updatePlayersPointsAndPeers = require('./updatePlayersPointsAndPeers')
const low = logger('combine', 'gray')
const log = logger('combine', 'white')
const logAdd = logger('combine', 'green')
const logInfo = logger('combine', 'blue')
const logError = logger('combine', 'yellow')

module.exports = async function({ game, tag, id }) {
  logAdd(`combining players by tag ${tag} into id ${id} (game ${game})`)
  if (!game || !id || !tag)
    return logError('unable to combine players!', gameTitle(game), id, tag)
  const playersToCombine = await db.getPlayerByTag(gameTitle(game), tag)
  if (
    !playersToCombine ||
    !Array.isArray(playersToCombine) ||
    playersToCombine.length < 2
  )
    return logError(
      'unable to combine players — appears to be only 1 by that tag',
      playersToCombine,
    )
  const masterPlayer = playersToCombine.find(p => p.id === id)
  const subPlayers = playersToCombine.filter(p => p.id !== id)
  if (!masterPlayer)
    return logError(
      `unable to combine players — can't find a player by the tag`,
      tag,
      `with id`,
      id,
    )

  subPlayers.forEach(subPlayer => {
    masterPlayer.participatedInEvents.push(...subPlayer.participatedInEvents)
    masterPlayer.points.push(...subPlayer.points)
    subPlayer.redirect = id
    delete subPlayer.lastActive
    delete subPlayer.lastUpdated
    delete subPlayer.participatedInEvents
    delete subPlayer.peers
    delete subPlayer.points
  })
  masterPlayer.lastActive = Date.now() / 1000
  await Promise.all(playersToCombine.map(player => db.addPlayer(player, false)))
  log(`combined ${playersToCombine.length} players`)

  await updatePlayersPointsAndPeers(masterPlayer, false, null, true)
}
