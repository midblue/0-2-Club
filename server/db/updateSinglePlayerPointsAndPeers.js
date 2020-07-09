const points = require('../points/points')
const db = require('./firebaseClient')

const logger = require('../scripts/log')
const low = logger('points&peers1', 'gray')
const log = logger('points&peers1', 'white')
const logAdd = logger('points&peers1', 'green')
const logInfo = logger('points&peers1', 'blue')
const logError = logger('points&peers1', 'yellow')

const minUpdateCutoff = 10 * 1000

module.exports = async function({ game, id, tag }) {
  // * player object might not be fully up-to-date, so grab it again
  const player = await db.getPlayer({ game, id, tag })
  if (!player) return logError('player not found!', game, id, tag)

  // if (player.lastUpdated * 1000 || 0 > Date.now() - minUpdateCutoff)
  //   return low(
  //     'Not updating',
  //     player.tag,
  //     '— was updated very recently',
  //     player.lastUpdated * 1000,
  //     Date.now() - minUpdateCutoff,
  //   )

  // get points
  let playerWithUnsavedPoints = await recalculatePoints(player)

  // then, get peers
  let playerWithUnsavedPeers = await recalculatePeers(player)

  if (playerWithUnsavedPeers) player.peers = playerWithUnsavedPeers.peers
  if (playerWithUnsavedPoints) player.points = playerWithUnsavedPoints.points

  await db.updatePlayer(player)
  if (!playerWithUnsavedPeers && !playerWithUnsavedPoints)
    low('nothing to save for player', player.tag)
  else logAdd(`saved points/peers/+ for ${player.tag}`)

  return player
}

async function recalculatePoints(player) {
  return new Promise(async resolve => {
    const startingPointsLength = (player.points || []).length
    player.points = await points.get(player)
    const wereNewPoints = startingPointsLength !== player.points.length
    resolve(wereNewPoints ? player : null)
  })
}

async function recalculatePeers(player) {
  const startingPeers = player.peers || []
  const idsByFrequency = {}

  await Promise.all(
    (player.participatedInEvents || []).slice(0, 10).map(async partialEvent => {
      const event = await db.getEvent({
        service: partialEvent.service,
        id: partialEvent.id,
        game: player.game,
      })
      if (!event || !event.participants) return
      const playerStanding = event.participants.find(p => p.id === player.id)
        .standing
      event.participants.forEach(({ id, tag, img, standing }) => {
        if (tag !== player.tag) {
          const standingSimilarity =
            1 -
              Math.abs(playerStanding - standing) / event.participants.length ||
            0
          idsByFrequency[id] = {
            tag,
            img,
            common:
              (idsByFrequency[id] ? idsByFrequency[id].common : 0) +
              standingSimilarity,
          }
        }
      })
    }),
  )

  const peers = Object.keys(idsByFrequency)
    .filter(id => idsByFrequency[id].common > 2)
    .sort((a, b) => idsByFrequency[b].common - idsByFrequency[a].common)
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
