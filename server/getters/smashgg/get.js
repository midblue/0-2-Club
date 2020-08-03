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

module.exports = {
  async event({ tournamentSlug, slug, eventSlug }) {
    if (!eventSlug && slug) eventSlug = slug
    if (!(tournamentSlug && eventSlug))
      return { err: 'missing event or tournament slug' }

    const removeFromLoadingList = () =>
      currentlyLoadingNewEvents.splice(
        currentlyLoadingNewEvents.indexOf(tournamentSlug + slug),
        1,
      )

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
      removeFromLoadingList()
      return { err: eventData.error }
    }
    const isDone = eventData.state === 'COMPLETED'
    if (!isDone) {
      removeFromLoadingList()
      return { err: 'not done' }
    }

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
      removeFromLoadingList()
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

      removeFromLoadingList()

      log(
        'done getting',
        eventSlug,
        tournamentSlug,
        eventData.id,
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
      removeFromLoadingList()
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

  moreEventStubsForPlayer(player, ownerIdsToCheck, onlyFromGame, limit = 50) {
    return new Promise(async resolve => {
      if (!player) return resolve([])

      let foundEvents = []

      const isUnknownEvent = ({ tournamentSlug, eventSlug }) => {
        return new Promise(async resolve => {
          const existsInNewFoundEvents = foundEvents.find(
            knownEvent =>
              knownEvent.tournamentSlug === tournamentSlug &&
              knownEvent.eventSlug === eventSlug,
          )
          if (existsInNewFoundEvents) return resolve(false)

          const existsInDb = await db.getEventExists({
            service: 'smashgg',
            tournamentSlug,
            eventSlug,
            game: player.game,
          })
          if (existsInDb) return resolve(false)

          return resolve(true)
        })
      }

      const isDone = () => {
        return foundEvents.length >= limit
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
          sets
            .reduce(
              (setsWithUniqueEvent, set) =>
                setsWithUniqueEvent.find(ue => ue.event.slug === set.event.slug)
                  ? setsWithUniqueEvent
                  : [...setsWithUniqueEvent, set],
              [],
            )
            .map(async set => {
              return new Promise(async resolve => {
                if (
                  !set.event ||
                  set.event.state !== 'COMPLETED' ||
                  (onlyFromGame &&
                    gameTitle(set.event.videogame.name) !==
                      gameTitle(onlyFromGame))
                )
                  return resolve()
                const [
                  wholeString,
                  tournamentSlug,
                  eventSlug,
                ] = /tournament\/([^/]*)\/event\/([^/]*)/g.exec(set.event.slug)
                if (!isSingles({ eventSlug })) return resolve()
                const isNew = await isUnknownEvent({
                  tournamentSlug,
                  eventSlug,
                })
                if (isNew) {
                  ownersFoundFromRecentSets.push(set.event.tournament.owner.id)
                  return resolve({
                    service: 'smashgg',
                    tournamentSlug,
                    eventSlug,
                    game: gameTitle(set.event.videogame.name),
                  })
                } else return resolve()
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

        ownersFoundFromRecentSets = Array.from(
          new Set(ownersFoundFromRecentSets),
        )
        if (ownersFoundFromRecentSets.length > 0 && !ownerIdsToCheck)
          low(
            `found ${ownersFoundFromRecentSets.length} owner/s from recent sets`,
          )
        foundEvents.push(...newPlayerSetEvents)
        if (isDone()) return resolve(foundEvents.slice(0, limit))
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
      await Promise.all(
        ownerIds.map(async ownerId => {
          if (isDone()) return
          let data = null,
            attempts = 0

          while (data === null && attempts < 2) {
            data = await makeQuery(queryTournamentsByOwner, {
              page: 1,
              ownerId,
              count: attempts > 0 ? 1 : 40,
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
                `Failed to get data for ownerId ${ownerId} on smashgg, retrying... (attempt ${attempts +
                  1})`,
              )
              attempts++
              data = null
            }
          }
          if (!data || isDone()) return

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

          foundEvents.push(...newEvents)
          if (isDone()) return resolve(foundEvents.slice(0, limit))
        }),
      )

      return resolve(foundEvents.slice(0, limit))
    })
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
        `Failed to get data for ${tournamentSlug} - ${eventSlug} on smashgg, retrying... (attempt ${attempts +
          1})`,
        data.error ||
          data.errors ||
          (data.data ? data.data.error || data.data.errors : 'no data'),
      )
      retries++
      data = null
    } else data = data.data.data.event
  }
  if (!isComplete(data)) return { error: 'not complete' }
  if (!isSingles(data)) return { error: 'not singles' }

  const totalSetNumber = data.sets.pageInfo.totalPages,
    totalStandingNumber = data.standings.pageInfo.totalPages

  const allSets = await getAllEventSetsOrStandings(
    tournamentSlug,
    eventSlug,
    'sets',
    totalSetNumber,
    45,
  )
  const allStandings = await getAllEventSetsOrStandings(
    tournamentSlug,
    eventSlug,
    'standings',
    totalStandingNumber,
    100,
  )

  // console.log(allSets)

  if (allSets.error) return { error: 'error getting sets: ' + allSets.error }
  data.sets.nodes = allSets

  if (allStandings.error)
    return { error: 'error getting standings: ' + allStandings.error }
  data.standings.nodes = allStandings

  if (!isSingles(data)) return { error: 'not singles' }

  return data
}

function isNotAlreadyLoading(event) {
  return !currentlyLoadingNewEvents.find(
    e => e === event.tournamentSlug + (event.eventSlug || event.slug),
  )
}

async function getAllEventSetsOrStandings(
  tournamentSlug,
  eventSlug,
  type,
  totalNumberOfElements,
  initialPerPage,
  maxRetries = 10,
) {
  return new Promise(resolve => {
    let retries = 0
    const allData = []
    let perPage = initialPerPage

    const getStartPoint = () => {
      let index = 0
      while (allData[index] !== undefined) index++
      if (index >= totalNumberOfElements) return false
      return index
    }

    const doneRatio = () => {
      let done = 0
      for (let i = 0; i < totalNumberOfElements; i++)
        if (allData[i] && allData[i] !== 'claimed') done++
      return done / totalNumberOfElements
    }

    const getSomeData = async () => {
      const currentPerPage = perPage
      const startPoint = getStartPoint()

      const tryAgainWithSmallerPerPage = async () => {
        for (let i = startPoint; i < startPoint + currentPerPage; i++)
          allData[i] = undefined
        perPage = Math.ceil(currentPerPage * 0.8)
        if (perPage !== initialPerPage) retries++
        if (retries > maxRetries) return resolve({ error: 'too many retries' })
        getSomeData()
      }

      try {
        if (startPoint === false) return
        const pageNumber = Math.floor(startPoint / currentPerPage)
        const startPointOnPage = startPoint % currentPerPage

        for (let i = startPoint; i < startPoint + currentPerPage; i++)
          allData[i] = 'claimed'
        allData.splice(totalNumberOfElements, 1000)

        const res = await makeQuery(
          type === 'sets' ? queryEventSets : queryEventStandings,
          {
            slug: `tournament/${tournamentSlug}/event/${eventSlug}`,
            perPage: currentPerPage,
            page: pageNumber + 1, // ! smashgg pages are fucking 1-indexed. this took me like 4 hours to figure out.
          },
        )
        if (
          !res ||
          !res.data ||
          res.error ||
          res.data.error ||
          res.data.errors ||
          (type === 'sets' &&
            (!res.data.data ||
              !res.data.data.event ||
              !res.data.data.event.sets.nodes))
        ) {
          logError(
            `Failed to get ${type} page ${pageNumber} (perPage ${currentPerPage}) for ${tournamentSlug} - ${eventSlug} on smashgg, retrying... (attempt ${retries +
              1})`,
            `(${JSON.stringify(
              (!res ? 'no data' : null) ||
                res.error ||
                res.data.error ||
                res.data.errors ||
                res.data,
              null,
              2,
            )})`,
          )
          tryAgainWithSmallerPerPage()
        } else {
          const actualArrayOfData =
            type === 'sets'
              ? res.data.data.event.sets.nodes
              : res.data.data.event.standings.nodes
          for (let i = startPointOnPage; i < actualArrayOfData.length; i++) {
            allData[currentPerPage * pageNumber + i] = actualArrayOfData[i]
            if (actualArrayOfData[i].error)
              return resolve({ error: actualArrayOfData[i].error })
          }
          if (doneRatio() === 1) return resolve(allData)
          else while (getStartPoint() !== false) getSomeData()
        }
      } catch (e) {
        logError(`error getting ${type}`, e)
        tryAgainWithSmallerPerPage()
      }
    }

    getSomeData()
  })
}
