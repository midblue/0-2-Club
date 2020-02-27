const db = require('../db/firebaseClient')
const scanForNewEventsForAllActivePlayers = require('./scanForNewEventsForAllActivePlayers')
const verifyPlayers = require('./verifyPlayers')
const verifyEvents = require('./verifyEvents')
const updatePlayersPointsAndPeers = require('../db/updatePlayersPointsAndPeers')

const logger = require('../scripts/log')
const low = logger('updater', 'gray')
const log = logger('updater', 'white')
const logAdd = logger('updater', 'green')
const logInfo = logger('updater', 'blue')
const logError = logger('updater', 'yellow')

module.exports = {
  scanForNewEvents,
  rollingUpdate,
}

let isScanning = false,
  isUpdating = false

const aDayInSeconds = 24 * 60 * 60
const aDayInMilliseconds = aDayInSeconds * 1000

let scanInterval, udpdateInterval
clearInterval(scanInterval)
clearInterval(udpdateInterval) // these are here for hot reloading
scanInterval = setInterval(
  scanForNewEvents,
  Math.round(aDayInMilliseconds * 1.997)
) // run about every 2 days (not even so it doesn't overlap with a reset)
udpdateInterval = setInterval(
  rollingUpdate,
  Math.round(aDayInMilliseconds / 30.03)
) // run ~30 times a day

// this will add new events for active players.
async function scanForNewEvents() {
  if (isUpdating || isScanning)
    return logError(
      'Skipping attempt to scan while update/scan is running'
    )
  if (!dbUsageIsOkay())
    return logError('Too close to db usage cap to scan')
  isScanning = true
  logInfo('starting scan for new events')
  try {
    await scanForNewEventsForAllActivePlayers()

    await db.logUsage()
  } catch (e) {
    logError('scan failed:', e)
    isScanning = false
    return
  }

  logInfo('scan complete')
  isScanning = false
}

// the goal here is to update a fairly consistent number of events & players each pass, without going overboard, and over a long enough timeline eventually touching every single player and event.
async function rollingUpdate() {
  if (isUpdating || isScanning)
    return logError(
      'Skipping attempt to update while update/scan is running'
    )
  if (!dbUsageIsOkay())
    return logError('Too close to db usage cap to scan')
  isUpdating = true
  logInfo('starting rolling update')
  let someEvents, players
  try {
    someEvents = await db.getSomeEvents(3)

    players = await verifyEvents(someEvents)

    await verifyPlayers(players)

    await updatePlayersPointsAndPeers(players)

    await db.logUsage()
  } catch (e) {
    logError('update failed:', e)
    isUpdating = false
    return
  }

  logInfo(
    'rolling update complete for',
    someEvents.length,
    'events and',
    players.length,
    'players.'
  )
  isUpdating = false
}

function dbUsageIsOkay() {
  const limit = 0.7
  const { reads, writes, deletes } = db.getLimitProximity()
  // low(
  //   'db daily usage:',
  //   parseInt(reads * 100) + '%',
  //   'reads,',
  //   parseInt(writes * 100) + '%',
  //   'writes,',
  //   parseInt(deletes * 100) + '%',
  //   'deletes'
  // )
  if (reads > limit || writes > limit || deletes > limit) return false
  return true
}
