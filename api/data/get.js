const services = { smashgg: require('./getters/smashgg') }
const db = require('./db/db')
const points = require('./points/points')
const logger = require('./scripts/log')
const log = logger('smashgg', 'white')
const logAdd = logger('smashgg', 'green')
const logError = logger('smashgg', 'yellow')

module.exports = {
  async dbStats() {
    return await db.stats()
  },

  event({ service, id, tournamentSlug, slug, retries = 0 }) {
    if (!service) return logError('A service is required to get an event.')
    if (!id && !tournamentSlug && !slug)
      return logError(
        'An id, tournamentSlug, or slug is required to get an event.'
      )
    return new Promise(async resolve => {
      let loadedEntry
      try {
        loadedEntry = await db.events.get({
          service,
          tournamentSlug,
          id,
          slug,
        })
        if (loadedEntry) {
          log(
            'found existing event:',
            loadedEntry.name,
            '-',
            loadedEntry.tournament.name
          )
          return resolve(loadedEntry)
        }

        loadedEntry = await services[service].event({
          id,
          tournamentSlug,
          slug,
          retries,
        })
        // console.log('loadedEntry:', loadedEntry)
        resolve(loadedEntry)
      } catch (e) {
        logError(
          'failed to get event',
          slug,
          'at',
          tournamentSlug,
          ':',
          e.code || e.err || e.error || e
        )
        if (retries < 10) {
          log(`retrying... (attempt ${retries + 2})`)
          return await this.event({
            service,
            id,
            tournamentSlug,
            slug,
            retries: retries + 1,
          })
        }
      }
      if (loadedEntry && !loadedEntry.err) {
        await db.events.add(loadedEntry)
        log(
          'found event from web:',
          loadedEntry.name,
          '-',
          loadedEntry.tournament.name
        )
      }
      resolve(loadedEntry)
    })
  },

  async player({ game, id, tag }) {
    if (!game || (!id && !tag)) return
    const loadedPlayer = await db.players.get({
      game,
      id,
      tag,
    })
    if (Array.isArray(loadedPlayer)) return { disambiguation: loadedPlayer }
    return loadedPlayer
  },

  async players({ game }) {
    if (!game) return
    return await db.players.all({ game })
  },

  async logToDb(event) {
    db.log(event)
  },

  async points({ game, id, tag }) {
    const loadedPlayer = await this.player({ game, id, tag })
    if (!loadedPlayer) return
    if (loadedPlayer.disambiguation) return loadedPlayer
    const peers = await db.players.peers(loadedPlayer)
    const playerPoints = await points.get(loadedPlayer)
    const collatedPlayerData = collatePointsIntoPlayerData(
      loadedPlayer,
      playerPoints
    )
    return { player: collatedPlayerData, points: playerPoints, peers }
  },

  async moreEventsForPlayer({ game, id, tag }) {
    if (!game || (!id && !tag)) return
    const loadedPlayer = await db.players.get({
      game,
      id,
      tag,
    })
    if (
      !loadedPlayer ||
      !loadedPlayer.participatedInEvents ||
      !loadedPlayer.participatedInEvents.length
    ) {
      logError('no player found for', game, id, tag)
      return []
    }

    // todo check ALL
    const randomEvent =
      loadedPlayer.participatedInEvents[
        Math.floor(Math.random() * loadedPlayer.participatedInEvents.length)
      ]
    const eventStubs = await services[randomEvent.service].moreEventsForPlayer(
      loadedPlayer
    )
    // if (!eventStubs.err)
    // db.events.add(loadedEntry)

    return eventStubs
  },

  async combineTag({ game, tag, id }) {
    return await db.players.combine({ game, tag, id })
  },
}

function collatePointsIntoPlayerData(player, allPoints) {
  const collatedEvents = player.participatedInEvents.map(event => {
    return {
      ...event,
      points: (allPoints || []).filter(
        point =>
          point.eventSlug === event.slug &&
          point.tournamentSlug === event.tournamentSlug
      ),
    }
  })
  return { ...player, participatedInEvents: collatedEvents }
}
