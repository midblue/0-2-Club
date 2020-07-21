const points = require('../points/points')
const db = require('./firebaseClient')
const { collatePointsIntoPlayerData } = require('./dbDataPrep')

const io = require('../io/io')()

const logger = require('../scripts/log')
const low = logger('points&peers', 'gray')
const log = logger('points&peers', 'white')
const logAdd = logger('points&peers', 'green')
const logInfo = logger('points&peers', 'blue')
const logError = logger('points&peers', 'yellow')

const minUpdateCutoff = 5 * 60 * 1000

module.exports = async function(
  players,
  quick = false,
  onlyTouchEventIds = null,
  forceUpdate = false,
) {
  if (!Array.isArray(players)) players = [players]

  console.log(players.length)

  // weed out players who have been updated too recently
  // — not necessary for quick because it doesn't make any extraneous db calls anyway
  if (!quick && !forceUpdate) {
    const initialPlayerCount = players.length
    players = players.filter(
      p => p.lastUpdated * 1000 || 0 > Date.now() - minUpdateCutoff,
    )
    if (players.length !== initialPlayerCount)
      low(
        `skipping updating points/peers for ${initialPlayerCount -
          players.length} player/s (too recent)`,
      )
  }

  // we were getting oom issues here so, batches.
  const batchSize = 100
  let currentBatchOfPlayersToUpdate = players.splice(0, batchSize)

  while (currentBatchOfPlayersToUpdate.length) {
    // player objects might not be fully up-to-date, so grab em again
    currentBatchOfPlayersToUpdate = await Promise.all(
      currentBatchOfPlayersToUpdate.map(
        async player => (await db.getPlayer(player)) || player,
      ),
    )

    // get points for all players
    let playersWithUnsavedPoints = (
      await Promise.all(
        currentBatchOfPlayersToUpdate.map(player => {
          io.to(`${player.game}/${player.id}`).emit(
            'notification',
            'Updating points & peers...',
          )
          io.to(`${player.game}/${player.tag}`).emit(
            'notification',
            'Updating points & peers...',
          )
          return recalculatePoints(
            player,
            players,
            quick,
            onlyTouchEventIds,
            forceUpdate,
          )
        }),
      )
    ).map(player => collatePointsIntoPlayerData(player))
    playersWithUnsavedPoints = playersWithUnsavedPoints.filter(p => p)

    // then, get peers for all players, skipping entirely if quick mode
    let playersWithUnsavedPeers = quick
      ? []
      : await Promise.all(
          currentBatchOfPlayersToUpdate.map(player => recalculatePeers(player)),
        )
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
      await Promise.all(playersToUpdate.map(p => db.updatePlayer(p, !quick)))
      logAdd(
        `saved ${quick ? 'quick ' : 'full '}points/peers for ${
          playersToUpdate.length === 1
            ? playersToUpdate[0].tag
            : `${playersToUpdate.length} players`
        }`,
      )
    }

    currentBatchOfPlayersToUpdate.forEach(player => {
      io.to(`${player.game}/${player.id}`).emit('playerFullyUpdated', player)
      io.to(`${player.game}/${player.tag}`).emit('playerFullyUpdated', player)
    })

    currentBatchOfPlayersToUpdate = players.splice(0, batchSize)
  }
}

async function recalculatePoints(
  player,
  players,
  quick,
  onlyTouchEventIds = null,
  forceUpdate,
) {
  return new Promise(async resolve => {
    const startingPointsLength = (player.points || []).length
    player.points = await points.get(player, onlyTouchEventIds, players, quick)
    const wereNewPoints = startingPointsLength !== player.points.length
    resolve(wereNewPoints || forceUpdate ? player : null)
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
