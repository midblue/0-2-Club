const fs = require('fs')

let data = null,
  dbBusy = false,
  dataToSave = null

const dbFilePath = './api/data/db/db.json'

fs.readFile(dbFilePath, async (err, loadedData) => {
  if (err && err.code === 'ENOENT') fs.writeFileSync(dbFilePath, '{}')
  else if (err) return console.error(err)
  data = loadedData ? JSON.parse(loadedData) : {}
  console.log(await stats())
})

setInterval(saveToDb, 2000)

let hasUpdatedSinceAnnounce = false
setInterval(async () => {
  if (hasUpdatedSinceAnnounce) console.log(await stats())
  hasUpdatedSinceAnnounce = false
}, 10 * 60 * 1000)

module.exports = {
  data,
  stats,
  events: {
    add: addEvent,
    get: getEvent,
  },
  players: {
    add: addOrUpdatePlayer,
    get: getPlayer,
    all: allPlayers,
  },
}

async function stats() {
  while (!data) await sleep(100)
  return {
    players: data.players ? data.players.length : 0,
    events: data.events ? data.events.length : 0,
  }
}

async function addEvent(event) {
  while (!data) await sleep(100)
  if (
    await getEvent({
      service: event.service,
      id: event.id,
      slug: event.slug,
      tournamentSlug: event.tournament.slug,
    })
  )
    return console.log(
      'attempted to double add event ' +
        event.name +
        ' on ' +
        event.service +
        ' to database'
    )
  console.log(
    'adding event ' + event.name + ' on ' + event.service + ' to database'
  )
  if (!data.events) data.events = []
  if (!event.game)
    return console.log(
      'not adding event',
      event.name,
      `to db because it's missing required data (game)`
    )
  data.events.push(event)
  dataToSave = data
  addOrUpdatePlayersFromEvent(event)
}

async function getEvent({ service, id, tournamentSlug, slug }) {
  while (!data) await sleep(100)
  const found = !data.events
    ? null
    : data.events.find(
        l =>
          l.service === service &&
          (tournamentSlug ? l.tournament.slug === tournamentSlug : true) &&
          (l.id === id || l.slug === slug)
      )
  // if (found) console.log('found ' + slug + ' in database.')
  return found
}

async function addOrUpdatePlayersFromEvent(event) {
  event.participants.forEach(p =>
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
          name: event.name,
          slug: event.slug,
          tournamentSlug: event.tournament.slug,
          tournamentName: event.tournament.name,
          entrantId: p.entrantId,
          matchesWithUser: event.sets.filter(
            s => s.winner.tag === p.tag || s.loser.tag === p.tag
          ),
        },
      ],
    })
  )
}

async function addOrUpdatePlayer(player) {
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
  dataToSave = data
}

async function getPlayer({ game, id, tag }) {
  while (!data) await sleep(100)
  const foundPlayer = !data.players
    ? null
    : data.players.find(p => p.game === game && p.tag === tag)
  // if (foundPlayer) console.log('found player ' + slug + ' in database.')
  return foundPlayer
}

async function getPlayerPeers({ game, id, tag }) {
  const player = await getPlayer({ game, id, tag })
  if (!player) return
  // todo get top peers by frequency
}

async function updatePlayer({ player, toUpdate }) {
  console.log('updating player', player.tag)
  for (let prop of Object.keys(toUpdate)) {
    console.log(prop, toUpdate[prop])
    if (Array.isArray(toUpdate[prop])) {
      // todo needs to be WAY more robust to prevent duplicates
      if (!player[prop]) {
        player[prop] = toUpdate[prop]
        console.log('added prop ' + prop + ' for ' + player.tag)
      } else
        toUpdate[prop].forEach(el => {
          if (!player[prop].find(playerEl => playerEl == el))
            // todo actually deep compare
            player[prop].push(el)
          console.log('added entry' + ' to ' + prop + ' for ' + player.tag)
        })
    }
    // or just set value
    else if (player[prop] !== toUpdate[prop]) {
      player[prop] = toUpdate[prop]
      console.log('updated prop ' + prop + ' for ' + player.tag)
    }
  }
  // data.players.find(p => p.tag === player.tag) = player // todo does this work without this?
  dataToSave = data
}

async function allPlayers({ game }) {
  while (!data) await sleep(100)
  return (data.players || []).filter(p => p.game === game)
}

function saveToDb() {
  if (!dataToSave) return
  if (dbBusy) return

  dbBusy = true
  const currentData = dataToSave
  dataToSave = null

  fs.writeFile(dbFilePath, JSON.stringify(currentData, null, 2), err => {
    dbBusy = false
    if (err) {
      console.log(err)
      if (!dataToSave) dataToSave = currentData
    }
  })

  hasUpdatedSinceAnnounce = true
}

const sleep = milliseconds => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
