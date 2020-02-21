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
// let updateStartOwnerId = Math.floor(Math.random() * 160000)
// check games too
// could possibly get from multiple games' events collections at once! :)
// ordered by owner id so we get similar players memoed

// setInterval(daily, aDayInMilliseconds)
// user 640241

// rollingUpdate()

// this will add new events for active players.
async function scanForNewEvents() {
  if (isUpdating || isScanning)
    return logError(
      'Skipping attempt to scan while update/scan is running'
    )
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
  isUpdating = true
  logInfo('starting rolling update')

  const someEvents = await db.getSomeEvents()

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

/*
    games = await db.getGames()

    for (let game of games) {
      // todo if there are players that need regenerating, might want to have a list in the DB for that (and code here to regen that player)
      // todo manually delete event/s from db

      //todo this is too big for the heap at about ~2500 players. we need to find a way to handle less players at a time!!!


      only get active players
        for each player
          get events for those players
          check that the events exist
          save updated data if any

          then,
          check for new events
            look in DB for existing events
              (make new knownToExist memo for events, ~2000)
              add to both memos if found
            check for players in event NOW in db
              add to db if actually new
              update if not
              (add to in-memory memo, ~300)
            new unsaved events -> db
            hold events for player in memory
              use those events & players to calculate points
                (allPlayers in points only needs opponents)











      allPlayers = allPlayers.filter(p => !p.redirect)

      // get new event info for all active players
      const alreadyCheckedOwnerIds = []
      const newUnsavedPlayers = []
      const newUnsavedEvents = []
      for (let player of activePlayers) {
        const memory = process.memoryUsage()
        const memoryUsedPercent = memory.heapUsed / memory.rss
        if (memoryUsedPercent > 0.8) {
          logError(
            'Low on memory, aborting remaining player updates. Will likely get to them on next daily.',
            Math.round(memory.heapUsed / 1024 / 1024),
            'mb of',
            Math.round(memory.rss / 1024 / 1024),
            'mb'
          )
          break
        }
        const {
          newOwnerIds,
          newPlayers,
          newEvents,
        } = await getNewEventsForPlayer(
          player,
          alreadyCheckedOwnerIds,
          allEvents,
          allPlayers
        )
        alreadyCheckedOwnerIds.push(...newOwnerIds)
        newUnsavedPlayers.push(...newPlayers)
        newUnsavedEvents.push(...newEvents)
      }

      if (newUnsavedEvents.length)
        logInfo(
          `${
            newUnsavedEvents.length
          } new events found for game ${gameTitle(game)}`
        )
      ;(newUnsavedPlayers.length > 0 ? log : low)(
        `${
          newUnsavedPlayers.length
        } new players found for ${gameTitle(game)}`
      )

      // at this point all new events are saved into the db AND exist nicely in our allEvents object,
      // and all new players are in allPlayers, unsaved.

      // then, get points for all players
      let playersWithUnsavedUpdatedPoints = await Promise.all(
        allPlayers.map(player =>
          recalculatePoints(player, allPlayers)
        )
      )
      playersWithUnsavedUpdatedPoints = playersWithUnsavedUpdatedPoints.filter(
        p => p
      )
      ;(playersWithUnsavedUpdatedPoints.length > 0 ? log : low)(
        `will update points for ${playersWithUnsavedUpdatedPoints.length} player/s`
      )
      // at this point, all players in allPlayers have updated points.

      // then, get peers for all players
      let playersWithUnsavedUpdatedPeers = await Promise.all(
        allPlayers.map(player => recalculatePeers(player, allEvents))
      )
      playersWithUnsavedUpdatedPeers = playersWithUnsavedUpdatedPeers.filter(
        p => p
      )
      ;(playersWithUnsavedUpdatedPeers.length > 0 ? log : low)(
        `will update peers for ${playersWithUnsavedUpdatedPeers.length} player/s`
      )
      // at this point, all players in allPlayers have updated peers and points.

      // then, save all updated players
      const playersToUpdate = playersWithUnsavedUpdatedPeers
      playersWithUnsavedUpdatedPoints.forEach(mightUpdate => {
        if (
          !playersToUpdate.find(
            alreadySaving => mightUpdate.id === alreadySaving.id
          )
        )
          playersToUpdate.push(mightUpdate)
      })
      playersWithFixedErroneousData.forEach(mightUpdate => {
        if (
          !playersToUpdate.find(
            alreadySaving => mightUpdate.id === alreadySaving.id
          )
        )
          playersToUpdate.push(mightUpdate)
      })

      if (newUnsavedPlayers.length + playersToUpdate.length > 0) {
        low(
          `saving data for ${newUnsavedPlayers.length +
            playersToUpdate.length} player/s...`
        )
        await Promise.all(newUnsavedPlayers.map(p => db.addPlayer(p)))
        await Promise.all(
          playersToUpdate.map(p => db.updatePlayer(p))
        )
        logAdd(
          `saved data for ${newUnsavedPlayers.length +
            playersToUpdate.length} player/s`
        )
      } else low(`no new player data to save`)

      // then, save all new events (done here to avoid a half-updated db if it hangs mid-daily)
      if (newUnsavedEvents.length > 0) {
        low(`saving data for ${newUnsavedEvents.length} event/s...`)
        await Promise.all(newUnsavedEvents.map(e => db.addEvent(e)))
        logAdd(`saved data for ${newUnsavedEvents.length} event/s`)
      } else low(`no new event data to save`)

      db.setStat(
        `playerCounts.${encodeURIComponent(gameTitle(game)).replace(
          /\./g,
          '+'
        )}`,
        allPlayers.length + newUnsavedPlayers.length
      )
      db.setStat(
        `eventCounts.${encodeURIComponent(gameTitle(game)).replace(
          /\./g,
          '+'
        )}`,
        allEvents.length + newUnsavedEvents.length
      )
    }

    logInfo(`daily full update complete!`)
    resolve()
  })
}










      */
