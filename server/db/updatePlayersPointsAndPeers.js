const points = require('../points/points')
const db = require('./firebaseClient')

const logger = require('../scripts/log')
const low = logger('points&peers', 'gray')
const log = logger('points&peers', 'white')
const logAdd = logger('points&peers', 'green')
const logInfo = logger('points&peers', 'blue')
const logError = logger('points&peers', 'yellow')

const minUpdateCutoff = 5 * 60 * 1000

module.exports = async function(players, quick = false) {
  // todo THIS is taking TONS of data and time
  // todo maybe we should just only ever update points & peers for users ONCE THEY GO to their page
  // todo instead of trying to do everyone forever
  // todo and then we can have a value for lastUpdatedPnP that won't re-update within 5 mins or so

  // weed out players who have been updated too recently
  // — not necessary for quick because it doesn't make any extraneous db calls anyway
  const initialPlayerCount = players.length
  if (!quick)
    players = players.filter(
      p => p.lastUpdated * 1000 || 0 > Date.now() - minUpdateCutoff,
    )
  if (players.length !== initialPlayerCount)
    low(
      `skipping updating points/peers for ${players.length -
        initialPlayerCount} players (too recent)`,
    )

  // get points for all players
  let playersWithUnsavedPoints = await Promise.all(
    players.map(player => recalculatePoints(player, players, quick)),
  )
  playersWithUnsavedPoints = playersWithUnsavedPoints.filter(p => p)

  // then, get peers for all players, skipping entirely if quick mode
  let playersWithUnsavedPeers = quick
    ? []
    : await Promise.all(players.map(player => recalculatePeers(player)))
  playersWithUnsavedPeers = playersWithUnsavedPeers.filter(p => p)

  // then, save all updated players
  const playersToUpdate = playersWithUnsavedPoints
  playersWithUnsavedPeers.forEach(mightUpdate => {
    if (
      !playersToUpdate.find(
        alreadySaving =>
          mightUpdate.id === alreadySaving.id &&
          mightUpdate.game === alreadySaving.game,
      )
    )
      playersToUpdate.push(mightUpdate)
  })

  if (playersToUpdate.length) {
    low('saving updated players to database...')
    await Promise.all(playersToUpdate.map(p => db.updatePlayer(p, !quick)))
    logAdd(`saved points/peers/+ for ${playersToUpdate.length} player/s`)
  }
}

async function recalculatePoints(player, players, quick) {
  return new Promise(async resolve => {
    const startingPointsLength = (player.points || []).length
    player.points = await points.get(player, null, players, quick)
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