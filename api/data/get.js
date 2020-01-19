// const services = { smashgg: require('./getters/smashgg') }
const db = require('./db/db')
const points = require('./points/points')

module.exports = {
  async dbStats() {
    return await db.stats()
  },

  async event({ service, id, tournamentSlug, slug, retries = 0 }) {
    if (!service) return
    if (!id && !tournamentSlug && !slug) return

    let loadedEntry
    try {
      loadedEntry = await db.events.get({
        service,
        tournamentSlug,
        id,
        slug,
      })
      if (loadedEntry) {
        console.log(
          'found existing event:',
          loadedEntry.name,
          '-',
          loadedEntry.tournament.name
        )
        return loadedEntry
      }

      loadedEntry = await services[service].event({ id, tournamentSlug, slug })
    } catch (e) {
      console.log(
        'failed to get event',
        slug,
        tournamentSlug,
        ':',
        e.code || e.err || e.error || e
      )
      if (retries < 10) {
        console.log('retrying...')
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
      db.events.add(loadedEntry)
      console.log(
        'found new event:',
        loadedEntry.name,
        '-',
        loadedEntry.tournament.name
      )
    }
    return loadedEntry
  },

  async player({ game, id, tag }) {
    if (!game || (!id && !tag)) return
    return await db.players.get({
      game,
      id,
      tag,
    })
  },

  async players({ game }) {
    if (!game) return
    return await db.players.all({ game })
  },

  async points({ game, id, tag }) {
    if (!game || (!id && !tag)) return
    const loadedPlayer = await db.players.get({
      game,
      id,
      tag,
    })
    if (!loadedPlayer) return
    const playerPoints = await points.get(loadedPlayer)
    return { player: loadedPlayer, points: playerPoints }
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
    )
      return

    // todo check ALL
    const randomEvent =
      loadedPlayer.participatedInEvents[
        Math.floor(Math.random() * loadedPlayer.participatedInEvents.length)
      ]
    const eventStubs = await services[randomEvent.service].moreEventsForPlayer({
      entrantId: randomEvent.entrantId,
      tournamentSlug: randomEvent.tournamentSlug,
      eventSlug: randomEvent.slug,
    })
    // if (!eventStubs.err)
    // db.events.add(loadedEntry)

    return eventStubs
  },
}
