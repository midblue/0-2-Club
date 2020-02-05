const services = require('./services')
const db = require('./firebaseClient')
const dbInterface = require('./updateManager')
const points = require('./points/points')
const logger = require('./scripts/log')
const low = logger('get', 'gray')
const log = logger('get', 'white')
const logAdd = logger('get', 'green')
const logError = logger('get', 'yellow')

module.exports = {
  async dbStats() {
    return await db.getStats()
  },

  event({ service, id, tournamentSlug, slug, game, retries = 0 }) {
    if (!service)
      return logError('A service is required to get an event.')
    if (!id && !tournamentSlug && !slug)
      return logError(
        'An id, tournamentSlug, or slug is required to get an event.'
      )
    return new Promise(async resolve => {
      let loadedEntry
      try {
        loadedEntry = await db.getEvent({
          service,
          tournamentSlug,
          id,
          slug,
          game,
        })
        if (loadedEntry) {
          low(
            'found existing event in db:',
            loadedEntry.name,
            '-',
            loadedEntry.tournamentName
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
          low(`retrying... (attempt ${retries + 2})`)
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
        await dbInterface.addEventWithNoContext(loadedEntry)
        log(
          `returning newly loaded event from ${loadedEntry.service}:`,
          loadedEntry.name,
          '-',
          loadedEntry.tournamentName
        )
      }
      resolve(loadedEntry)
    })
  },

  async player({ game, id, tag }) {
    if (!game || (!id && !tag)) return
    const loadedPlayer = await db.getPlayer({
      game,
      id,
      tag,
    })
    if (Array.isArray(loadedPlayer))
      return { disambiguation: loadedPlayer }
    return loadedPlayer
  },

  async players({ game }) {
    if (!game) return
    return await db.getPlayers({ game })
  },

  async logToDb(event) {
    db.log(event)
  },

  async setActive({ game, id, tag, player }) {
    if (!player) player = await this.player({ game, id, tag })
    if (!player || player.disambiguation) return
    db.setPlayerActive(player)
  },

  async points({ game, id, tag, setActive = false }) {
    const loadedPlayer = await this.player({ game, id, tag })
    if (!loadedPlayer) return
    if (loadedPlayer.disambiguation) return loadedPlayer

    if (setActive) this.setActive(loadedPlayer)

    const collatedPlayerData = collatePointsIntoPlayerData(
      loadedPlayer
    )
    return collatedPlayerData
  },

  async moreEventsForPlayer({ game, id, tag }) {
    if (!game || (!id && !tag)) return
    const loadedPlayer = await this.player({ game, id, tag })
    if (!loadedPlayer) return
    if (
      !loadedPlayer ||
      !loadedPlayer.participatedInEvents ||
      !loadedPlayer.participatedInEvents.length
    ) {
      logError('no player found for', game, id, tag)
      return []
    }
    if (loadedPlayer.disambiguation) {
      logError(
        'disambiguation required to get more events for',
        game,
        id,
        tag
      )
      return []
    }

    db.setPlayerActive(loadedPlayer)

    // todo check all services
    const randomEvent =
      loadedPlayer.participatedInEvents[
        Math.floor(
          Math.random() * loadedPlayer.participatedInEvents.length
        )
      ]
    const eventStubs = await services[
      randomEvent.service
    ].moreEventsForPlayer(loadedPlayer, null, null, loadedPlayer.game)
    // if (!eventStubs.err)
    // db.events.add(loadedEntry)

    return eventStubs
  },

  async combineTag({ game, tag, id }) {
    return await dbInterface.combinePlayers({ game, tag, id })
  },
}

function collatePointsIntoPlayerData(player) {
  const collatedEvents = player.participatedInEvents.map(event => {
    return {
      ...event,
      points: (player.points || []).filter(
        point =>
          point.eventSlug === event.slug &&
          point.tournamentSlug === event.tournamentSlug
      ),
    }
  })
  return { ...player, participatedInEvents: collatedEvents }
}
