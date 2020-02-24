const db = require('./firebaseClient')
const scanForNewEventsForAllActivePlayers = require('./scanForNewEventsForAllActivePlayers')
const verifyPlayers = require('./verifyPlayers')
const verifyEvents = require('./verifyEvents')
const updatePlayersPointsAndPeers = require('./updatePlayersPointsAndPeers')

const logger = require('./scripts/log')
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

setInterval(scanForNewEvents, aDayInMilliseconds * 2) // run every 2 days
setInterval(rollingUpdate, aDayInMilliseconds / 20) // run 20 times a day

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

  await scanForNewEventsForAllActivePlayers()

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

  const someEvents = await db.getSomeEvents(3)

  const players = await verifyEvents(someEvents)

  await verifyPlayers(players)

  await updatePlayersPointsAndPeers(players)

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
  const { reads, writes, deletes } = db.getLimitProximity()
  log(reads, writes, deletes)
  if (reads > 0.8 || writes > 0.8 || deletes > 0.9) return false
  return true
}
