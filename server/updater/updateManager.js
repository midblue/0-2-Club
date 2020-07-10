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

let scanTimeout, udpdateTimeout
clearTimeout(scanTimeout)
clearTimeout(udpdateTimeout) // these are here for hot reloading
scanTimeout = setTimeout(
  scanForNewEvents,
  Math.round(aDayInMilliseconds * 1.997),
)
udpdateTimeout = setTimeout(
  rollingUpdate,
  Math.round(aDayInMilliseconds / 60.03),
)

// this will add new events for active players.
async function scanForNewEvents() {
  if (isUpdating || isScanning)
    return logError('Skipping attempt to scan while update/scan is running')
  if (!dbUsageIsOkay()) {
    scanTimeout = setTimeout(
      scanForNewEvents,
      Math.round(aDayInMilliseconds / 2),
    ) // try again in 12 hours
    return logError('Too close to db usage cap to scan, postponing...')
  }
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
  scanTimeout = setTimeout(
    scanForNewEvents,
    Math.round(aDayInMilliseconds * 1.997),
  ) // run again in 2 days
}

// the goal here is to update a fairly consistent number of events & players each pass, without going overboard, and over a long enough timeline eventually touching every single player and event.
async function rollingUpdate() {
  if (isUpdating || isScanning)
    return logError('Skipping attempt to update while update/scan is running')
  if (!dbUsageIsOkay()) {
    updateTimeout = setTimeout(
      rollingUpdate,
      Math.round(aDayInMilliseconds / 2),
    ) // try again in 12 hours
    return logError('Too close to db usage cap to update, postponing...')
  }
  isUpdating = true
  logInfo('starting rolling update')
  let someEvents, players
  try {
    someEvents = await db.getSomeEvents(1)

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
    'players.',
  )
  isUpdating = false
  updateTimeout = setTimeout(
    rollingUpdate,
    Math.round(aDayInMilliseconds / 20.03),
  ) // run again in a few hours
}

function dbUsageIsOkay() {
  const limit = 0.7
  const { reads, writes, deletes } = db.getLimitProximity()
  low(
    'db daily usage:',
    parseInt(reads * 100) + '%',
    'reads,',
    parseInt(writes * 100) + '%',
    'writes,',
    parseInt(deletes * 100) + '%',
    'deletes',
  )
  if (reads > limit || writes > limit || deletes > limit) return false
  return true
}
