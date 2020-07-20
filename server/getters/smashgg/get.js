const db = require('../../db/firebaseClient')

const {
  makeQuery,
  queryEvent,
  queryEventSets,
  queryEventStandings,
  queryPlayerSets,
  queryTournamentsByOwner,
  queryEventsInTournament,
} = require('./query')

const {
  isComplete,
  isSingles,
  parseEventStubsFromTournaments,
} = require('./helperFunctions')

const { parseParticipantTag, gameTitle } = require('../../../common/functions')

const silent = () => {}
const logger = require('../../scripts/log')
const log = logger('smashgg', 'gray')
const low = silent //logger('smashgg', 'gray')
const logAdd = logger('smashgg', 'green')
const logError = logger('smashgg', 'yellow')

const currentlyLoadingNewEvents = []
// sometimes has trouble with double call to MORE, can get stuck with entries left in it

module.exports = {
  async event({ tournamentSlug, slug, eventSlug }) {
    if (!eventSlug && slug) eventSlug = slug
    if (!(tournamentSlug && eventSlug))
      return { err: 'missing event or tournament slug' }

    if (currentlyLoadingNewEvents.find(e => e === tournamentSlug + eventSlug)) {
      logError(
        'already loading this event! load queue length:',
        currentlyLoadingNewEvents.length,
      )
      return { err: 'already loading' }
    } else currentlyLoadingNewEvents.push(tournamentSlug + eventSlug)
    // log(currentlyLoadingNewEvents)

    const eventData = await getEvent(tournamentSlug, eventSlug)
    if (!eventData || eventData.error) {
      logError(`skipping event:`, eventData.error)
      return { err: eventData.error }
    }
    const isDone = eventData.state === 'COMPLETED'
    if (!isDone) return { err: 'not done' }

    // it's possible to start loading this while it's waiting for data, so we check again
    if (
      currentlyLoadingNewEvents.filter(e => e === tournamentSlug + eventSlug)
        .length !== 1
    ) {
      logError(
        'skipping double loading this event!',
        tournamentSlug,
        eventSlug,
        tournamentSlug + eventSlug,
        currentlyLoadingNewEvents,
      )
      currentlyLoadingNewEvents.splice(
        currentlyLoadingNewEvents.indexOf(tournamentSlug + slug),
        1,
      )
      return { err: 'already loading' }
    }
    try {
      const participants = eventData.standings.nodes.map(s => ({
        standing: s.placement,
        of: eventData.standings.nodes.length,
        tag: parseParticipantTag(s.entrant.participants[0].player.gamerTag),
        id: s.entrant.participants[0].player.id,
        entrantId: s.entrant.id,
        img:
          s.entrant.participants[0].user &&
          s.entrant.participants[0].user.images &&
          s.entrant.participants[0].user.images.length > 0
            ? s.entrant.participants[0].user.images[0].url
            : false,
      }))

      const sets = (eventData.sets.nodes || [])
        .map(s => {
          const player1 = {
              id: s.slots[0].entrant.participants[0].player.id,
              placement: s.slots[0].standing.placement,
              tag: parseParticipantTag(
                s.slots[0].entrant.participants[0].player.gamerTag,
              ),
              score: s.slots[0].standing.stats.score.value,
              img:
                s.slots[0].entrant.participants[0].user &&
                s.slots[0].entrant.participants[0].user.images &&
                s.slots[0].entrant.participants[0].user.images.length > 0
                  ? s.slots[0].entrant.participants[0].user.images[0].url
                  : false,
            },
            player2 = {
              id: s.slots[1].entrant.participants[0].player.id,
              placement: s.slots[0].standing.placement,
              tag: parseParticipantTag(
                s.slots[1].entrant.participants[0].player.gamerTag,
              ),
              score: s.slots[1].standing.stats.score.value,
              img:
                s.slots[1].entrant.participants[0].user &&
                s.slots[1].entrant.participants[0].user.images &&
                s.slots[1].entrant.participants[0].user.images.length > 0
                  ? s.slots[1].entrant.participants[0].user.images[0].url
                  : false,
            }
          let winner, loser
          if (player1.score > player2.score) {
            winner = player1
            loser = player2
          } else if (player1.score < player2.score) {
            winner = player2
            loser = player1
          } else if (player1.placement === 1) {
            winner = player1
            loser = player2
          } else {
            winner = player2
            loser = player1
          }
          return {
            date: s.completedAt,
            winnerId: winner.id,
            loserId: loser.id,
            winnerTag: winner.tag,
            loserTag: loser.tag,
            winnerScore: winner.score,
            loserScore: loser.score,
            winnerImg: winner.img,
            loserImg: loser.img,
          }
        })
        .filter(s => s)

      currentlyLoadingNewEvents.splice(
        currentlyLoadingNewEvents.indexOf(tournamentSlug + eventSlug),
        1,
      )

      log(
        'done getting',
        eventSlug,
        tournamentSlug,
        'on smash.gg,',
        currentlyLoadingNewEvents.length,
        'left in queue',
      )

      // log(currentlyLoadingNewEvents)

      const eventDataToReturn = {
        id: eventData.id,
        name: eventData.name,
        eventSlug,
        game: gameTitle(eventData.videogame.name),
        date: eventData.startAt,
        service: 'smashgg',
        tournamentSlug,
        tournamentName: eventData.tournament.name,
        ownerId: eventData.tournament.owner.id,
        participants,
        sets,
      }
      if (eventData.images.length > 0)
        eventDataToReturn.img = eventData.images[0].url
      return eventDataToReturn
    } catch (e) {
      logError('malformed data for', eventSlug, tournamentSlug, e)
      return { err: 'malformed data' }
    }
  },

  async eventsForGameInTournament(game, tournamentSlug) {
    log('getting all events for game', game, 'from tournament', tournamentSlug)
    if (!game || !tournamentSlug) return []
    const res = await makeQuery(queryEventsInTournament, {
      slug: tournamentSlug,
    })
    const tournament = res.data.data.tournament
    if (!tournament) return []
    const events = res.data.data.tournament.events
      .filter(e => gameTitle(e.videogame.name) === gameTitle(game))
      .filter(isSingles)
      .map(e => ({
        name: e.name,
        eventSlug: e.slug.substring(e.slug.lastIndexOf('/') + 1),
        tournamentSlug,
        game: gameTitle(e.videogame.name),
        id: e.id,
      }))
    return events
  },

  async moreEventStubsForPlayer(
    player,
    ownerIdsToCheck,
    existingEvents,
    onlyFromGame,
  ) {
    if (!player) return []

    let foundEvents = []

    const isUnknownEvent = async ({ tournamentSlug, eventSlug }) => {
      return new Promise(async resolve => {
        // todo takes the bulk of the time when querying for new events

        const existsInNewFoundEvents = foundEvents.find(
          knownEvent =>
            knownEvent.tournamentSlug === tournamentSlug &&
            knownEvent.eventSlug === eventSlug,
        )
        if (existsInNewFoundEvents) return resolve(false)

        const existsInDb = existingEvents
          ? existingEvents.find(
              existingEvent =>
                existingEvent.tournamentSlug === tournamentSlug &&
                existingEvent.eventSlug === eventSlug &&
                existingEvent.service === 'smashgg',
            )
          : await db.getEventExists({
              service: 'smashgg',
              tournamentSlug,
              eventSlug: eventSlug,
              game: player.game,
            })

        if (existsInDb) return resolve(false)

        return resolve(true)
      })
    }

    // check recent sets for that player via api
    let ownersFoundFromRecentSets = []
    if (player.id) {
      const res = await makeQuery(queryPlayerSets, {
        id: player.id,
      })
      let sets
      if (!res.data.data || !res.data.data.player) {
        logError(
          `Failed to get recent sets for player ${
            player.id
          } on smashgg. (${JSON.stringify(
            res.data.error ||
              res.data.errors ||
              res.data.data.error ||
              res.data.data.errors,
            null,
            2,
          )})`,
        )
        sets = []
      } else sets = res.data.data.player.sets.nodes || []
      let newPlayerSetEvents = await Promise.all(
        sets.map(async set => {
          return new Promise(async resolve => {
            if (
              !set.event ||
              set.event.state !== 'COMPLETED' ||
              (onlyFromGame &&
                gameTitle(set.event.videogame.name) !== gameTitle(onlyFromGame))
            )
              return resolve()
            const [
              wholeString,
              tournamentSlug,
              eventSlug,
            ] = /tournament\/([^/]*)\/event\/([^/]*)/g.exec(set.event.slug)
            const isNew = await isUnknownEvent({
              tournamentSlug,
              eventSlug,
            })
            if (isNew) {
              ownersFoundFromRecentSets.push(set.event.tournament.owner.id)
              resolve({
                service: 'smashgg',
                tournamentSlug,
                eventSlug,
                game: gameTitle(set.event.videogame.name),
              })
            } else resolve()
          })
        }),
      )
      newPlayerSetEvents = newPlayerSetEvents
        .filter(e => e)
        // filter out internal duplicates
        .reduce((newEvents, e) => {
          if (
            newEvents.find(
              newEvent =>
                newEvent.eventSlug === e.eventSlug &&
                newEvent.tournamentSlug === e.tournamentSlug,
            )
          )
            return newEvents
          return [...newEvents, e]
        }, [])
        .filter(isSingles)
        .filter(isNotAlreadyLoading)
      if (newPlayerSetEvents.length > 0)
        log(
          newPlayerSetEvents.length,
          'additional event/s found via api for player',
          player.tag,
        )
      else low('no new events found via api for player', player.tag)

      ownersFoundFromRecentSets = Array.from(new Set(ownersFoundFromRecentSets))
      if (ownersFoundFromRecentSets.length > 0 && !ownerIdsToCheck)
        low(
          `found ${ownersFoundFromRecentSets.length} owner/s from recent sets`,
        )
      foundEvents.push(...newPlayerSetEvents)
    }

    // then check other events from the same organizer as all events concerning user
    const ownerIds =
      ownerIdsToCheck ||
      Array.from(
        new Set([
          ...player.participatedInEvents
            .filter(event => event.service === 'smashgg')
            .map(e => e.ownerId),
          ...ownersFoundFromRecentSets,
        ]),
      )

    if (ownerIds.length)
      low(
        'will check',
        ownerIds.length,
        'owner/s —',
        ownerIdsToCheck ? 'preset' : 'organic',
      )
    const eventsFromOwnerIds = await Promise.all(
      ownerIds.map(async ownerId => {
        let data = null,
          attempts = 0
        while (data === null && attempts < 2) {
          data = await makeQuery(queryTournamentsByOwner, {
            page: 1,
            ownerId,
          })
          if (
            !data ||
            !data.data ||
            data.data.errors ||
            data.error ||
            !data.data.data.tournaments ||
            !data.data.data.tournaments.nodes
          ) {
            logError(
              `Failed to get data for ownerId ${ownerId} on smashgg, retrying... (attempt ${attempts})`,
            )
            attempts++
            data = null
          }
        }
        if (!data) return []

        let newEvents = await parseEventStubsFromTournaments(
          data.data.data.tournaments.nodes,
          onlyFromGame,
        )
        newEvents = await Promise.all(
          newEvents.map(async e => {
            const isUnknown = await isUnknownEvent(e)
            if (isUnknown) return e
            return false
          }),
        )

        newEvents = newEvents
          .filter(e => e)
          .filter(isSingles)
          .filter(isNotAlreadyLoading)
        if (newEvents.length > 0)
          log(newEvents.length, 'additional event/s found via owner', ownerId)
        else low('no new events found via owner', ownerId)

        return newEvents
      }),
    )
    eventsFromOwnerIds.forEach(eventList => foundEvents.push(...eventList))

    return foundEvents
  },
}

async function getEvent(tournamentSlug, eventSlug) {
  let data,
    attempts = 0
  while (!data) {
    if (attempts > 4) return { error: 'tried too many times' }
    log(`getting new event data for ${tournamentSlug} - ${eventSlug}...`)
    data = await makeQuery(queryEvent, {
      page: 1,
      slug: `tournament/${tournamentSlug}/event/${eventSlug}`,
    })
    if (
      !data ||
      !data.data ||
      data.data.error ||
      data.error ||
      data.errors ||
      data.data.errors ||
      !data.data.data.event ||
      !data.data.data.event.sets ||
      !data.data.data.event.sets.pageInfo
    ) {
      logError(
        `Failed to get data for ${tournamentSlug} - ${eventSlug} on smashgg, retrying... (attempt ${attempts})`,
        data.error ||
          data.errors ||
          (data.data ? data.data.error || data.data.errors : 'no data'),
      )
      attempts++
      data = null
    } else data = data.data.data.event
  }
  if (!isComplete(data)) return { error: 'not complete' }
  if (!isSingles(data)) return { error: 'not singles' }

  data.sets.nodes = []
  data.standings.nodes = []

  const totalSetNumber = data.sets.pageInfo.totalPages,
    totalStandingNumber = data.standings.pageInfo.totalPages

  // todo dynamically raise/lower perPage

  let perSetQueryPage = 14
  let perStandingQueryPage = 70

  const totalSetPages = Math.ceil(totalSetNumber / perSetQueryPage),
    totalStandingPages = Math.ceil(totalStandingNumber / perStandingQueryPage)

  let allSets = []
  for (
    let currentSetsPage = 1;
    currentSetsPage <= totalSetPages;
    currentSetsPage++
  ) {
    allSets.push(
      new Promise(async resolve => {
        let moreSets,
          attempts = 0
        while (!moreSets && attempts < 5) {
          attempts++
          moreSets = await makeQuery(queryEventSets, {
            page: currentSetsPage,
            slug: `tournament/${tournamentSlug}/event/${eventSlug}`,
            perPage: perSetQueryPage,
          })
          if (
            !moreSets ||
            !moreSets.data ||
            moreSets.data.error ||
            moreSets.error ||
            !moreSets.data.data ||
            !moreSets.data.data.event ||
            !moreSets.data.data.event.sets.nodes
          ) {
            logError(
              `Failed to get sets page ${currentSetsPage} for ${tournamentSlug} - ${eventSlug} on smashgg, retrying... (attempt ${attempts})`,
              `(${JSON.stringify(
                (!moreSets
                  ? 'no data at all! perQueryPage might be too high.'
                  : null) ||
                  moreSets.data.error ||
                  moreSets.data.errors ||
                  moreSets.data,
                null,
                2,
              )})`,
            )
            moreSets = null
          }
        }
        if (!moreSets) return resolve({ error: 'no sets data!' })
        moreSets = moreSets.data.data.event.sets.nodes
        low(
          'got sets page',
          currentSetsPage,
          'for',
          `${tournamentSlug} - ${eventSlug}`,
        )
        return resolve(moreSets)
      }),
    )
  }

  let allStandings = []
  for (
    let currentStandingsPage = 1;
    currentStandingsPage <= totalStandingPages;
    currentStandingsPage++
  ) {
    allStandings.push(
      new Promise(async resolve => {
        let moreStandings,
          attempts = 0
        while (!moreStandings && attempts < 5) {
          attempts++
          moreStandings = await makeQuery(queryEventStandings, {
            page: currentStandingsPage,
            slug: `tournament/${tournamentSlug}/event/${eventSlug}`,
            perPage: perStandingQueryPage,
          })
          if (
            !moreStandings ||
            !moreStandings.data ||
            moreStandings.data.error ||
            moreStandings.error
          ) {
            logError(
              `Failed to get more standings for ${tournamentSlug} - ${eventSlug} on smashgg, retrying... (attempt ${attempts})`,
            )
            moreStandings = null
          }
        }
        if (!moreStandings) return resolve({ error: 'no standings data!' })
        moreStandings = moreStandings.data.data.event.standings.nodes
        low(
          'got standings page',
          currentStandingsPage,
          'for',
          `${tournamentSlug} - ${eventSlug}`,
        )
        return resolve(moreStandings)
      }),
    )
  }

  allSets = await Promise.all(allSets)
  allSets = [].concat.apply([], allSets)
  if (allSets.find(s => s.error))
    return { error: allSets.find(s => s.error).error }
  data.sets.nodes = allSets

  allStandings = await Promise.all(allStandings)
  allStandings = [].concat.apply([], allStandings)
  if (allStandings.find(s => s.error))
    return { error: allStandings.find(s => s.error).error }
  data.standings.nodes = allStandings

  return data
}

function isNotAlreadyLoading(event) {
  return !currentlyLoadingNewEvents.find(
    e => e === event.tournamentSlug + (event.eventSlug || event.slug),
  )
}
