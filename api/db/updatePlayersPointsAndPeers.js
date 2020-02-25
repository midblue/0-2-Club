const points = require('../points/points')
const db = require('./firebaseClient')

const logger = require('../scripts/log')
const low = logger('points&peers', 'gray')
const log = logger('points&peers', 'white')
const logAdd = logger('points&peers', 'green')
const logInfo = logger('points&peers', 'blue')
const logError = logger('points&peers', 'yellow')

module.exports = async function(players) {
  // get points for all players
  let playersWithUnsavedPoints = await Promise.all(
    players.map(player => recalculatePoints(player, players))
  )
  playersWithUnsavedPoints = playersWithUnsavedPoints.filter(p => p)
  // if (playersWithUnsavedPoints.length)
  //   log(
  //     `will update points for ${playersWithUnsavedPoints.length} player/s`
  //   )

  // then, get peers for all players
  let playersWithUnsavedPeers = await Promise.all(
    players.map(player => recalculatePeers(player))
  )
  playersWithUnsavedPeers = playersWithUnsavedPeers.filter(p => p)
  // if (playersWithUnsavedPeers.length)
  //   log(
  //     `will update peers for ${playersWithUnsavedPeers.length} player/s`
  //   )

  // then, save all updated players
  const playersToUpdate = playersWithUnsavedPoints
  playersWithUnsavedPeers.forEach(mightUpdate => {
    if (
      !playersToUpdate.find(
        alreadySaving =>
          mightUpdate.id === alreadySaving.id &&
          mightUpdate.game === alreadySaving.game
      )
    )
      playersToUpdate.push(mightUpdate)
  })

  if (playersToUpdate.length) {
    await Promise.all(playersToUpdate.map(p => db.updatePlayer(p)))
    logAdd(
      `saved points/peers/+ for ${playersToUpdate.length} player/s`
    )
  }
}

async function recalculatePoints(player, players) {
  return new Promise(async resolve => {
    const startingPointsLength = (player.points || []).length
    player.points = await points.get(player, null, players)
    const wereNewPoints =
      startingPointsLength !== player.points.length
    resolve(wereNewPoints ? player : null)
  })
}

async function recalculatePeers(player) {
  // todo? make this based on avg % overlap over all events for both players, not just raw numbers
  const startingPeers = player.peers || []
  const idsByFrequency = {}

  await Promise.all(
    (player.participatedInEvents || [])
      .slice(0, 10)
      .map(async partialEvent => {
        const event = await db.getEvent({
          service: partialEvent.service,
          id: partialEvent.id,
          game: player.game,
        })
        if (!event || !event.participants) return
        event.participants.forEach(({ id, tag, img }) => {
          if (tag !== player.tag)
            idsByFrequency[id] = {
              tag,
              img,
              common:
                (idsByFrequency[id] ? idsByFrequency[id].common : 0) +
                1,
            }
        })
      })
  )

  const peers = Object.keys(idsByFrequency)
    .filter(id => idsByFrequency[id].common > 2)
    .sort(
      (a, b) => idsByFrequency[b].common - idsByFrequency[a].common
    )
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
