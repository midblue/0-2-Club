const db = require('./firebaseClient')
const memoryOk = require('./scripts/memoryOk')
const getAndAddNewEventsForPlayer = require('./getAndAddNewEventsForPlayer')

const logger = require('./scripts/log')
const low = logger('eventscanner', 'gray')
const log = logger('eventscanner', 'white')
const logAdd = logger('eventscanner', 'green')
const logInfo = logger('eventscanner', 'blue')
const logError = logger('eventscanner', 'yellow')

const { gameTitle } = require('../../common/functions').default

let games = []

module.exports = async function() {
  return new Promise(async resolve => {
    logInfo(`scanning for new events for all active players`)
    games = await db.getGames()

    for (let game of games) {
      const activePlayers = await db.getActivePlayers(game)
      logInfo(
        `${
          activePlayers.length
        } active player/s found for game ${gameTitle(game)}`
      )
      db.updateActive(game, activePlayers.length)
      const alreadyCheckedOwnerIds = []
      const newUnsavedEvents = []
      for (let player of activePlayers) {
        const { newOwnerIds } = await getAndAddNewEventsForPlayer(
          player,
          alreadyCheckedOwnerIds
        )
        alreadyCheckedOwnerIds.push(...newOwnerIds)
      }
    }

    resolve()
  })
}