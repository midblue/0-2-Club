const services = require('./services')

const logger = require('./scripts/log')
const low = logger('updater', 'gray')
const log = logger('updater', 'white')
const logAdd = logger('updater', 'green')
const logError = logger('updater', 'yellow')

let games = []

// setInterval(daily, 24 * 60 * 60 * 1000)
setTimeout(daily, 30000)

function daily() {
  return new Promise(async resolve => {
    games = await getGamesFromDb()

    // todo this might try to do EVERYTHING at once, which would just be a clusterfuck. let's see.
    games.forEach(async game => {
      const activePlayers = await getActivePlayersFromDb(game.name)
      const passivePlayers = await getPassivePlayersFromDb(game.name)
      const allEvents = await getEventsFromDb(game.name)
      await Promise.all([activePlayers, passivePlayers, allEvents])
      low(
        `${activePlayers.length} active and ${passivePlayers.length} passive players found in ${allEvents.length} events for game ${game.name}`
      )

      // get new event info for all active players
      const alreadyCheckedOwnerIds = []
      const eventPromises = activePlayers.map(async player => {
        return new Promise(async resolve => {
          const playerEventOwnerIds = await getOwnerIds(player)
          const newOwnerIds = playerEventOwnerIds.filter(
            id =>
              !alreadyCheckedOwnerIds.find(
                existingId => existingId === id
              )
          )
          alreadyCheckedOwnerIds.push(...newOwnerIds)
          const stubs = await getMoreEventStubs(
            player,
            newOwnerIds,
            allEvents
          )
          const newEvents = await loadNewEvents(stubs)
          if (newEvents && newEvents.length > 0) {
            allEvents.push(...newEvents)
            await saveNewEventsToDb(newEvents)
          }
          resolve()
        })
      })
      // wait for them to settle before moving on to point calculation
      await Promise.all(eventPromises)

      // then, get points for all players
      const pointPromises = [...activePlayers, ...passivePlayers].map(
        player => {
          return new Promise(async resolve => {
            const wereNewPoints = await recalculatePoints(player, [
              ...activePlayers,
              ...passivePlayers,
            ])
            if (wereNewPoints) await savePlayerToDb(player)
            resolve()
          })
        }
      )
      // wait for them to settle before calling it done
      await Promise.all(pointPromises)

      resolve()
    })
  })
}

async function getGamesFromDb() {
  /*
await stats.default.games

*/
}

async function getActivePlayersFromDb(game) {
  /*
	await get where game = game && lastActive is <= 10 days

	*/
}

async function getPassivePlayersFromDb(game) {
  /*
	await get where game = game && (!lastActive || lastActive is > 10 days)

	*/
}

async function getEventsFromDb(game) {
  // await get where game === game
}

async function savePlayerToDb(player) {
  // await set players[player.id] = player
}

async function saveNewEventsToDb(events) {
  const savePromises = events.map(saveEventToDb)
  await Promise.all(savePromises)
  return
}
async function saveEventToDb(event) {
  // await set events[event.service + event.id] = event
  return
}

async function getOwnerIds(events) {
  if (!events) return []
  if (events.participatedInEvents)
    events = events.participatedInEvents
  return Array.from(
    new Set(events.map(event => event.ownerId))
  ).filter(id => id)
}

async function getMoreEventStubs(
  player,
  ownerIdsToCheck,
  knownEvents
) {
  if (!player) return
  const servicesList = player.participatedInEvents.reduce(
    (list, event) => {
      if (!list.find(s => s === event.service))
        return [...list, event.service]
      return list
    },
    []
  )
  const eventPromises = servicesList.map(s => {
    services[s].moreEventsForPlayer(player, ownerIdsToCheck)
  })
  await Promise.all(eventPromises)
  const eventStubs = [].concat.apply([], eventPromises)
  if (eventStubs.length > 0)
    log(
      `${eventStubs.length} new events found for ${
        player.tag
      } on ${servicesList.join(' and ')}`
    )
  return eventStubs
}

async function loadNewEvents(eventStubs) {
  const eventData = eventStubs.map(stub => {
    services[stub.service].event(stub)
  })
  await Promise.all(eventData)
  return eventData
}
