const services = require('./services')
const db = require('./firebaseClient')
const addSingleEvent = require('./addSingleEvent')
const getAndAddNewEventsForPlayer = require('./getAndAddNewEventsForPlayer')
const combinePlayers = require('./combinePlayers')
const logger = require('./scripts/log')
const low = logger('get', 'gray')
const log = logger('get', 'white')
const logAdd = logger('get', 'green')
const logError = logger('get', 'yellow')
const { gameTitle } = require('../../common/f').default

module.exports = {
  async dbStats() {
    return await db.getStats()
  },

  event({
    service,
    id,
    tournamentSlug,
    slug,
    game,
    retries = 0,
    onlyUpdatePlayers = false,
  }) {
    if (!service)
      return logError('A service is required to get an event.')
    if (!(id || tournamentSlug))
      return logError(
        'An id, tournamentSlug, or slug is required to get an event.'
      )
    return new Promise(async resolve => {
      if (!id && !slug) {
        // if this is just a tournament slug, we need to get the events from it first
        const events = await services[
          service
        ].eventsForGameInTournament(game, tournamentSlug)
        const loadedEvents = await Promise.all(
          events.map(e => this.event({ service, id: e.id, game }))
        )
        return resolve(loadedEvents)
      }

      let loadedEntry
      try {
        loadedEntry = await db.getEvent({
          service,
          tournamentSlug,
          id,
          slug,
          game: gameTitle(game),
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

      if (loadedEntry && !loadedEntry.err)
        await addSingleEvent(loadedEntry, onlyUpdatePlayers)

      resolve(loadedEntry)
    })
  },

  async player({ game, id, tag }) {
    if (!game || (!id && !tag)) return
    const loadedPlayer = await db.getPlayer({
      game: gameTitle(game),
      id,
      tag,
    })
    if (Array.isArray(loadedPlayer))
      return { disambiguation: loadedPlayer }
    return loadedPlayer
  },

  async logToDb(event) {
    db.log(event)
  },

  async setActive({ game, id, tag, player }) {
    if (!player)
      player = await this.player({ game: gameTitle(game), id, tag })
    if (!player || player.disambiguation) return
    db.setPlayerActive(player)
  },

  async moreEventsForPlayer({ game, id, tag }) {
    if (!game || (!id && !tag)) return []
    const loadedPlayer = await this.player({
      game: gameTitle(game),
      id,
      tag,
    })
    if (!loadedPlayer) return []
    if (
      !loadedPlayer ||
      !loadedPlayer.participatedInEvents ||
      !loadedPlayer.participatedInEvents.length
    ) {
      logError('no player found for', gameTitle(game), id, tag)
      return []
    }
    if (loadedPlayer.disambiguation) {
      logError(
        'disambiguation required to get more events for',
        gameTitle(game),
        id,
        tag
      )
      return []
    }

    db.setPlayerActive(loadedPlayer)

    return await getAndAddNewEventsForPlayer(loadedPlayer)
  },

  async combineTag({ game, tag, id }) {
    return await combinePlayers({
      game: gameTitle(game),
      tag,
      id,
    })
  },
}

function collatePointsIntoPlayerData(player) {
  const collatedEvents = (player.participatedInEvents || []).map(
    event => {
      return {
        ...event,
        points: (player.points || []).filter(
          point =>
            point.eventSlug === event.slug &&
            point.tournamentSlug === event.tournamentSlug
        ),
      }
    }
  )
  return { ...player, participatedInEvents: collatedEvents }
}
