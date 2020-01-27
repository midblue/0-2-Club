const fs = require('fs')
const logger = require('../scripts/log')
const log = logger('db', 'white')
const logAdd = logger('db', 'green')
const logError = logger('db', 'yellow')

let data = null

const dbFilePath = './api/data/db/db.json'

if (!data) {
  fs.readFile(dbFilePath, async (err, loadedData) => {
    if (err && err.code === 'ENOENT')
      fs.writeFileSync(dbFilePath, '{}')
    else if (err) return logError(err)
    data = loadedData ? JSON.parse(loadedData) : {}
    log(await stats())
  })

  // setInterval(putDataIntoDb, 10000)

  // let hasUpdatedSinceAnnounce = false
  // setInterval(async () => {
  //   if (hasUpdatedSinceAnnounce) log(await stats())
  //   hasUpdatedSinceAnnounce = false
  // }, 10 * 60 * 1000)
}

module.exports = {
  stats,
  log: logToDb,
  events: {
    add: addEvent,
    get: getEvent,
  },
  players: {
    add: addOrUpdatePlayer,
    get: getPlayer,
    all: allPlayers,
    peers: getPlayerPeers,
    combine,
  },
}

async function stats() {
  while (!data) await sleep(100)
  return {
    players: data.players ? data.players.length : 0,
    events: data.events ? data.events.length : 0,
    log: data.log,
  }
}

async function logToDb(event) {
  if (typeof event !== 'string') return
  while (!data) await sleep(100)
  if (!data.log) data.log = {}
  data.log[event] = (data.log[event] || 0) + 1
  save()
}

function addEvent(event) {
  return new Promise(async resolve => {
    while (!data) await sleep(100)
    if (
      await getEvent({
        service: event.service,
        id: event.id,
        slug: event.slug,
        tournamentSlug: event.tournament.slug,
      })
    )
      return logError(
        'attempted to double add event ' +
          `${event.name} @ ${event.tournament.name}` +
          ' on ' +
          event.service +
          ' to database'
      )
    logAdd(
      'adding event ' +
        `${event.name} @ ${event.tournament.name}` +
        ' on ' +
        event.service +
        ' to database'
    )
    if (!data.events) data.events = []
    if (!event.game)
      return logError(
        'not adding event',
        `${event.name} @ ${event.tournament.name}`,
        `to db because it's missing required data (game)`
      )
    data.events.push(event)
    save()
    await addOrUpdatePlayersFromEvent(event)
    resolve()
  })
}

async function getEvent({ service, id, tournamentSlug, slug }) {
  while (!data) await sleep(100)
  // console.log('getEvent', id, tournamentSlug, slug)
  const found = !data.events
    ? null
    : data.events.find(
        l =>
          l.service === service &&
          (tournamentSlug
            ? l.tournament.slug == tournamentSlug
            : true) &&
          ((l.id && l.id == id) || (l.slug && l.slug == slug))
      )
  // if (found)
  //   console.log(
  //     'found ' + slug + ' @ ' + tournamentSlug + ` (${id})` + ' in database.'
  //   )
  return found
}

function addOrUpdatePlayersFromEvent(event) {
  return Promise.all(
    event.participants.map(p =>
      addOrUpdatePlayer({
        game: event.game,
        id: p.id,
        tag: p.tag,
        participatedInEvents: [
          {
            date: event.date,
            standing: p.standing,
            totalParticipants: p.of,
            service: event.service,
            id: event.id,
            entrantId: p.entrantId,
            name: event.name,
            slug: event.slug,
            tournamentSlug: event.tournament.slug,
            tournamentName: event.tournament.name,
            ownerId: event.tournament.ownerId,
            matchesWithUser: event.sets.filter(
              s => s.winner.tag === p.tag || s.loser.tag === p.tag
            ),
          },
        ],
      })
    )
  )
}

async function addOrUpdatePlayer(player) {
  return new Promise(async resolve => {
    while (!data) await sleep(100)
    const foundPlayer = await getPlayer({
      game: player.game,
      id: player.id,
      tag: player.tag,
    })
    if (foundPlayer) {
      updatePlayer({ player: foundPlayer, toUpdate: player })
      return
    }
    if (!data.players) data.players = []
    data.players.push(player)
    save()
    resolve()
  })
}

function getPlayer({ game, id, tag }) {
  //todo create participatedinevents from master event entry every time to make db smaller
  // may return null, one player, or an array of players.
  if (!game) return null
  return new Promise(async resolve => {
    while (!data) await sleep(100)

    let foundPlayer
    // if by ID, no disambiguation required
    if (id) {
      foundPlayer = !data.players
        ? null
        : data.players.find(p => p.game === game && p.id === id)
      // follow redirects
      if (foundPlayer && foundPlayer.redirect)
        foundPlayer = data.players.find(
          p => p.id === foundPlayer.redirect
        )
    }
    // if by tag, may require disambiguation
    else if (tag) {
      foundPlayer = !data.players
        ? null
        : data.players.filter(
            p => p.game === game && p.tag === tag && !p.redirect
          )
      if (foundPlayer && foundPlayer.length === 1)
        foundPlayer = foundPlayer[0]
      else if (foundPlayer && foundPlayer.length > 0) {
        foundPlayer = foundPlayer.sort(
          (a, b) =>
            b.participatedInEvents.length -
            a.participatedInEvents.length
        )
        logError(
          'found multiple players in the database by the tag',
          tag,
          'for',
          game
        )
      } else foundPlayer = null
    }
    // if (foundPlayer)
    //   console.log('found player ' + foundPlayer.tag + ' in database')
    resolve(foundPlayer)
  })
}

async function getPlayerPeers(player) {
  // todo? make this % overlap based, not just numbers
  if (!player.participatedInEvents) player = await getPlayer(player)
  if (!player) return
  const idsByFrequency = {}
  await Promise.all(
    player.participatedInEvents.map(partialEvent => {
      return new Promise(async resolve => {
        const event = await getEvent(partialEvent)
        event.participants.forEach(({ id, tag }) => {
          if (tag !== player.tag)
            idsByFrequency[id] = {
              tag,
              common:
                (idsByFrequency[id] ? idsByFrequency[id].common : 0) +
                1,
            }
        })
        resolve()
      })
    })
  )
  const peers = Object.keys(idsByFrequency)
    .filter(id => idsByFrequency[id].common > 2)
    .sort(
      (a, b) => idsByFrequency[b].common - idsByFrequency[a].common
    )
    .slice(0, 10)
    .map(id => ({ id, ...idsByFrequency[id] }))
  return peers
}

async function updatePlayer({ player, toUpdate }) {
  // console.log('updating player', player.tag)
  for (let prop of Object.keys(toUpdate)) {
    if (Array.isArray(toUpdate[prop])) {
      if (!player[prop]) {
        player[prop] = toUpdate[prop]
        // console.log('added prop ' + prop + ' for ' + player.tag)
      } else
        toUpdate[prop].forEach(el => {
          if (!player[prop].find(playerEl => playerEl == el))
            // todo actually deep compare
            player[prop].push(el)
          // console.log('added entry to ' + prop + ' for ' + player.tag)
        })
    }
    // or just set value
    else if (player[prop] !== toUpdate[prop]) {
      player[prop] = toUpdate[prop]
      // console.log('updated prop ' + prop + ' for ' + player.tag)
    }
  }
  save()
}

async function allPlayers({ game }) {
  while (!data) await sleep(100)
  return (data.players || []).filter(p => p.game === game)
}

async function combine({ game, tag, id }) {
  while (!data) await sleep(100)
  const foundPlayers = await getPlayer({ game, tag })
  if (
    !foundPlayers ||
    !Array.isArray(foundPlayers) ||
    foundPlayers.length < 2
  )
    return false

  const destinationPlayer = foundPlayers.find(p => p.id === id)
  log(
    'Combining ids',
    foundPlayers.map(p => p.id).join(', '),
    'going by the tag',
    tag,
    'into id',
    destinationPlayer.id
  )
  foundPlayers.forEach(player => {
    if (player.id !== id) {
      destinationPlayer.participatedInEvents.push(
        ...player.participatedInEvents
      )
      player.participatedInEvents = []
      player.redirect = id
    }
  })
  save()
  return id
}

let saveTimeout, dataToSave
function save() {
  dataToSave = data
  clearTimeout(saveTimeout)
  saveTimeout = setTimeout(putDataIntoDb, 30 * 1000)
}

let dbBusy
function putDataIntoDb() {
  if (!dataToSave) return
  if (dbBusy) return
  dbBusy = true
  const currentData = dataToSave
  dataToSave = null
  fs.writeFile(
    dbFilePath,
    JSON.stringify(currentData, null, 2),
    err => {
      dbBusy = false
      if (err) {
        logError(err)
        if (!dataToSave) dataToSave = currentData
      }
    }
  )
  // hasUpdatedSinceAnnounce = true
}

const sleep = milliseconds => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
