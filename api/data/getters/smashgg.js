// const $$ = require('./selectorOnPage')

const axios = require('axios')

const { parseParticipantTag } = require('../../../common/f').default

const logger = require('../scripts/log')
const log = logger('smashgg', 'white')
const low = logger('smashgg', 'gray')
const logAdd = logger('smashgg', 'green')
const logError = logger('smashgg', 'yellow')

const rateLimiter = require('../scripts/rateLimiter')
const limiter = new rateLimiter(12, 10000)

const db = require('../db/db.js')

const currentlyLoadingNewEvents = []

module.exports = {
  async event({ tournamentSlug, slug }) {
    if (!(tournamentSlug && slug)) return

    if (currentlyLoadingNewEvents.find(e => e === tournamentSlug + slug))
      logError(
        'already loading this event! load queue length:',
        currentlyLoadingNewEvents.length
      )
    else currentlyLoadingNewEvents.push(tournamentSlug + slug)
    // log(currentlyLoadingNewEvents)

    const eventData = await getEvent(tournamentSlug, slug)
    if (!eventData || eventData.error)
      return logError(`skipping event:`, eventData.error)
    // todo check for error
    const isDone = eventData.state === 'COMPLETED'
    if (!isDone) return { err: 'not done' }

    const participants = eventData.standings.nodes.map(s => ({
      standing: s.placement,
      of: eventData.standings.nodes.length,
      tag: parseParticipantTag(s.entrant.name),
      id: s.entrant.participants[0].player.id,
      entrantId: s.entrant.id,
    }))

    const sets = (eventData.sets.nodes || [])
      .map(s => {
        const player1 = {
            id: s.slots[0].entrant.participants[0].player.id,
            entrantId: s.slots[0].entrant.id,
            tag: parseParticipantTag(s.slots[0].entrant.name),
            score: s.entrant1Score,
          },
          player2 = {
            id: s.slots[1].entrant.participants[0].player.id,
            entrantId: s.slots[1].entrant.id,
            tag: parseParticipantTag(s.slots[1].entrant.name),
            score: s.entrant2Score,
          }
        const winner = player1.entrantId === s.winnerId ? player1 : player2
        const loser = player2.entrantId === s.winnerId ? player1 : player2
        return {
          date: s.completedAt,
          winner,
          loser,
        }
      })
      .filter(s => s)

    currentlyLoadingNewEvents.splice(
      currentlyLoadingNewEvents.indexOf(tournamentSlug + slug),
      1
    )

    log(
      'done getting',
      slug,
      tournamentSlug,
      'on smash.gg,',
      currentlyLoadingNewEvents.length,
      'left in queue'
    )

    // log(currentlyLoadingNewEvents)

    return {
      id: eventData.id,
      name: eventData.name,
      slug: slug,
      game: eventData.videogame.name,
      date: eventData.startAt,
      service: 'smashgg',
      tournament: {
        id: eventData.tournament.id,
        slug: tournamentSlug,
        name: eventData.tournament.name,
        ownerId: eventData.tournament.ownerId,
      },
      participants,
      sets,
    }
  },

  async moreEventsForPlayer(player) {
    if (!player) return []

    let foundEvents = []

    async function isUnknownEvent({ tournamentSlug, eventSlug }) {
      return new Promise(async resolve => {
        const existsInNewFoundEvents = foundEvents.find(
          knownEvent =>
            knownEvent.tournamentSlug === tournamentSlug &&
            knownEvent.eventSlug === eventSlug
        )
        if (existsInNewFoundEvents) return resolve(false)

        const existsInDb = await db.events.get({
          service: 'smashgg',
          tournamentSlug,
          slug: eventSlug,
        })
        if (existsInDb) return resolve(false)

        return resolve(true)
      })
    }

    const playerEventsToCheck = player.participatedInEvents.filter(
      event => event.service === 'smashgg'
    )

    // check recent sets for that player via api
    if (player.id) {
      const res = await makeQuery(queryPlayerSets, {
        id: player.id,
      })
      let sets
      if (!res.data.data.player) {
        logError(
          `Failed to get recent sets for player ${
            player.id
          } on smashgg. (${JSON.stringify(
            res.data.error || res.data.data.error || res.data.data.errors,
            null,
            2
          )})`
        )
        sets = []
      } else sets = res.data.data.player.recentSets || []
      let newPlayerSetEvents = await Promise.all(
        sets.map(async set => {
          return new Promise(async resolve => {
            if (
              !set.event ||
              set.event.state !== 'COMPLETED' ||
              set.slots.length > 2
            )
              return resolve()
            const [
              wholeString,
              tournamentSlug,
              eventSlug,
            ] = /tournament\/([^/]*)\/event\/([^/]*)/g.exec(set.event.slug)
            const isNew = await isUnknownEvent({ tournamentSlug, eventSlug })
            if (isNew)
              resolve({
                service: 'smashgg',
                tournamentSlug,
                eventSlug,
              })
            else resolve()
          })
        })
      )
      newPlayerSetEvents = newPlayerSetEvents
        .filter(e => e)
        // filter out internal duplicates
        .reduce((newEvents, e) => {
          if (
            newEvents.find(
              newEvent =>
                newEvent.eventSlug === e.eventSlug &&
                newEvent.tournamentSlug === e.tournamentSlug
            )
          )
            return newEvents
          return [...newEvents, e]
        }, [])
        .filter(isSingles)
        .filter(isNotAlreadyLoading)
      if (newPlayerSetEvents.length === 0)
        low('no new events found via api for player', player.tag)
      else
        log(
          newPlayerSetEvents.length,
          'additional events found via api for player',
          player.tag
        )
      if (newPlayerSetEvents.length > 0)
        logError('Should recheck, may be new owners.')
      //todo that
      foundEvents.push(...newPlayerSetEvents)
    }

    // then check other events from the same organizer as all events concerning user
    const ownerIds = await parseOwnersFromEvents(playerEventsToCheck)
    // log(ownerIds.length, 'owners found')
    const eventsFromOwnerIds = await Promise.all(
      ownerIds.map(async ownerId => {
        let data = null,
          attempts = 0
        while (data === null && attempts < 10) {
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
              `Failed to get data for ownerId ${ownerId} on smashgg, retrying... `
            )
            //   (${JSON.stringify(
            //     data.error || data.data.error || data.data.errors,
            //     null,
            //     2
            //   )})`
            // )
            attempts++
            data = null
          }
        }
        if (!data) return []

        let newEvents = await parseEventStubsFromTournaments(
          data.data.data.tournaments.nodes,
          player.game
        )
        newEvents = await Promise.all(
          newEvents.map(async e => {
            const isUnknown = await isUnknownEvent(e)
            if (isUnknown) return e
            return false
          })
        )
        newEvents = newEvents
          .filter(e => e)
          .filter(isSingles)
          .filter(isNotAlreadyLoading)
        if (newEvents.length === 0)
          low('no new events found via owner', ownerId)
        else log(newEvents.length, 'additional events found via owner', ownerId)
        return newEvents
      })
    )
    eventsFromOwnerIds.forEach(eventList => foundEvents.push(...eventList))

    // then grab 'em
    if (foundEvents.length > 0)
      logAdd(
        'will load new events:\n                        ',
        foundEvents
          .map(e => e.tournamentSlug + ' - ' + e.eventSlug)
          .join('\n                         ')
      )
    return foundEvents
  },
}

async function getEvent(tournamentSlug, eventSlug) {
  let data,
    attempts = 0
  while (!data) {
    log(`getting new event data for ${tournamentSlug} - ${eventSlug}`)
    data = await makeQuery(queryEvent, {
      page: 1,
      slug: `tournament/${tournamentSlug}/event/${eventSlug}`,
    })
    if (
      !data ||
      !data.data ||
      data.data.error ||
      data.error ||
      !data.data.data.event ||
      !data.data.data.event.sets ||
      !data.data.data.event.sets.pageInfo
    ) {
      logError(
        `Failed to get data for ${tournamentSlug} - ${eventSlug} on smashgg, retrying...`
        // (${JSON.stringify(
        //   data.error || data.data.error || data.data.errors || data.data,
        //   null,
        //   2
        // )})`
      )
      attempts++
      data = null
    } else if (attempts > 9) return { error: 'tried too many times' }
    else data = data.data.data.event
  }
  if (!isSingles(data)) return { error: 'not singles' }
  let setsPage = 1,
    standingsPage = 1
  let areMoreSets = data.sets.pageInfo.totalPages > setsPage,
    areMoreStandings = data.standings.pageInfo.totalPages > standingsPage

  // todo should be able to get ALLLLLLLLA these at once np instead of waiting for a damg response every time
  // todo also for fuck's sake we can get more sets etc per call... LET'S.
  // like start from page 0 with just pageInfo and go for the gold from page one all the time. 2 calls for tiny events but WAY less calls for the big ones
  while (areMoreSets) {
    setsPage++
    low(
      'getting sets page',
      setsPage,
      'for',
      `${tournamentSlug} - ${eventSlug}`
    )
    let moreSets = await makeQuery(queryEventSets, {
      page: setsPage,
      slug: `tournament/${tournamentSlug}/event/${eventSlug}`,
    })
    if (
      !moreSets ||
      !moreSets.data ||
      moreSets.data.error ||
      moreSets.error ||
      !moreSets.data.data.event ||
      !moreSets.data.data.event.sets.nodes
    ) {
      logError(
        `Failed to get sets page`,
        setsPage,
        `for ${tournamentSlug} - ${eventSlug} on smashgg, retrying...`,
        `(${JSON.stringify(
          (!moreSets ? 'no data at all!' : null) ||
            moreSets.data.error ||
            moreSets.data.data.error ||
            moreSets.data.data.errors,
          null,
          2
        )})`
      )
      setsPage--
      continue
    }
    moreSets = moreSets.data.data.event.sets.nodes
    data.sets.nodes.push(...moreSets)

    areMoreSets = data.sets.pageInfo.totalPages > setsPage
  }

  while (areMoreStandings) {
    standingsPage++
    low(
      'getting standings page',
      standingsPage,
      'for',
      `${tournamentSlug} - ${eventSlug}`
    )
    let moreStandings = await makeQuery(queryEventStandings, {
      page: standingsPage,
      slug: `tournament/${tournamentSlug}/event/${eventSlug}`,
    })
    if (
      !moreStandings.data ||
      moreStandings.data.error ||
      moreStandings.error
    ) {
      logError(
        `Failed to get more standings for ${tournamentSlug} - ${eventSlug} on smashgg, retrying...`
      )
      standingsPage--
      continue
    }
    moreStandings = moreStandings.data.data.event.standings.nodes
    data.standings.nodes.push(...moreStandings)

    areMoreStandings = data.standings.pageInfo.totalPages > standingsPage
  }
  // console.log(data.data)
  return data
}

async function makeQuery(query, variables) {
  // log('querying smashgg api:', query.substring(7, query.indexOf('(')))
  const request = {
    url: 'https://api.smash.gg/gql/alpha',
    method: 'post',
    headers: {
      Authorization: `Authorization: Bearer ${process.env.SMASHGG_APIKEY}`,
    },
    data: {
      query,
      variables,
    },
  }
  // console.log(request)
  return limiter.queue(() => {
    return axios(request).catch(error => {
      logError('axios error:', error)
      return
    })
  })
}

function isSingles(event) {
  const hasNumbers = /(?:[２３４234][ -]?(?:vs?|on)[ -]?[２３４234]|doubles)/gi
  if (hasNumbers.exec(event.slug || event.eventSlug)) return false
  if (hasNumbers.exec(event.name || '')) return false
  return true
}

function isNotAlreadyLoading(event) {
  return !currentlyLoadingNewEvents.find(
    e => e === event.tournamentSlug + (event.slug || event.eventSlug)
  )
}

async function parseOwnersFromEvents(events) {
  return Array.from(
    new Set(
      await Promise.all(
        events.map(async ({ id }) => {
          const eventData = await db.events.get({ service: 'smashgg', id })
          return eventData.tournament.ownerId
        })
      )
    )
  )
}

async function parseEventStubsFromTournaments(tournaments, game) {
  return tournaments.reduce((eventsAccumulator, tournament) => {
    const tournamentEvents =
      tournament.events && tournament.events.length
        ? tournament.events
            .filter(
              event =>
                event.videogame.name === game &&
                event.state === 'COMPLETED' &&
                event.sets.nodes &&
                event.sets.nodes.length > 0
            )
            .map(event => {
              const [
                wholeString,
                tournamentSlug,
                eventSlug,
              ] = /tournament\/([^/]*)\/event\/([^/]*)/g.exec(event.slug)
              return {
                service: 'smashgg',
                eventSlug,
                tournamentSlug,
              }
            })
        : []
    return [...eventsAccumulator, ...tournamentEvents]
  }, [])
}

const queryEvent = `
query EventInfo($slug: String, $page: Int!) {
  event(slug: $slug) {
    id
    name
    slug
    state
    startAt
    videogame {
      images {
        url
      }
      name
    }
    tournament {
      id
      name
      slug
      ownerId
    }
    standings (query: {
      page: $page,
      perPage: 40
    }) {
      pageInfo {
        totalPages
      }
      nodes {
        id
        placement
        entrant {
          id
          name
          participants {
            player {
              id
            }
          }
        }
      }
    }
    sets(
      page: $page,
      perPage: 40,
      sortType: STANDARD,
      filters: {
        hideEmpty: true
      }
    ) {
      pageInfo {
        totalPages
      }
      nodes {
        completedAt
        winnerId
        entrant1Score
        entrant2Score
        slots {
          entrant {
            id
            name
              participants {
              player {
                id
              }
            }
          }
        }
      }
    }
  }
}`

const queryPlayerSets = `
query PlayerSets ($id: ID!) {
  player(id: $id) {
    recentSets {
      slots {
        slotIndex
      }
      event {
        id
        name
        state
        slug
        tournament {
          id
          name
          slug
        }
      }
    }
  }
}`

const queryEventSets = `
query EventSets($slug: String, $page: Int!) {
  event(slug: $slug) {
    sets(
      page: $page,
      perPage: 40,
      sortType: STANDARD
      filters: {
        hideEmpty: true
      }
    ) {
      nodes {
        completedAt
        winnerId
        entrant1Score
        entrant2Score
        slots {
          entrant {
            id
            name
            participants {
              player {
                id
              }
            }
          }
        }
      }
    }
  }
}`

const queryEventStandings = `
query EventStandings($slug: String, $page: Int!) {
  event(slug: $slug) {
    standings (query: {
      page: $page,
      perPage: 40
    }) {
      nodes {
        id
        placement
        entrant {
          id
          name
          participants {
            player {
              id
            }
          }
        }
      }
    }
  }
}`

const queryTournamentsByOwner = `
query TournamentsByOwner($ownerId: ID!) {
    tournaments(query: {
      perPage: 40
      filter: {
        ownerId: $ownerId
      }
    }) {
    nodes {
      events {
        id
        slug
        state
        name
        videogame {
          name
          slug
        }
        sets (
          page: 1,
          perPage: 1,
          filters: {
            hideEmpty: true
          }
        ){
          nodes {
            id
          }
        }
      }
    }
  }
}`

// async function getTournament(tournamentSlug) {
//   await makeQuery(queryTournament, {
//     slug: tournamentSlug,
//   })
// }

// const queryTournament = `query TournamentQuery($slug: String) {
// 		tournament(slug: $slug){
// 			id
//    	  images {
//         url
//       }
// 			name
//     	slug
// 			events {
// 			  id
//         name
//         slug
//         state
//         videogame {
//           images{
//             url
//           }
//           name
//         }
//         tournament {
//           id
//           name
//           slug
//         }
//         entrants {
//           nodes{
//             id
//             name
//           }
//       	}
// 			}
// 		}
//   }`

// ;(async function() {
//   makeQuery(queryTournament, {
//     slug: 'the-dojo-s-sunday-smash-18',
//   })
// })()

//   async moreEventsForPlayer({ id, eventSlug, tournamentSlug }) {
//     if (!id || !eventSlug) return
//     const eventPromises = await (
//       await $$(
//         `https://smash.gg/tournament/${tournamentSlug}/event/${eventSlug}/entrant/${id}`,
//         '.profileContents .tourney-content .AttendeeDetailsPage div div div div div section + section div div div > a'
//       )
//     ).map(async el => await (await el.getProperty('href')).jsonValue())
//     const urls = await Promise.all(eventPromises)
//     const relevantURLs = urls.filter(url => /\/entrant\//g.exec(url))
//     const events = relevantURLs.map(url => {
//       const [
//         wholeString,
//         ts,
//         es,
//       ] = /\/tournament\/([^/]*)\/event\/([^/]*)/g.exec(url)
//       return {
//         service: 'smashgg',
//         tournamentSlug: ts,
//         eventSlug: es,
//       }
//     })
//     return events
//   },
// }

// // first check all user events for related events with puppeteer
// if (playerEventsToCheck.length > 0) {
//   const eventToCheck =
//     playerEventsToCheck[
//       Math.floor(Math.random() * playerEventsToCheck.length)
//     ]
//   if (eventToCheck.entrantId) {
//     const puppeteerEventPromises = await (
//       await $$(
//         `https://smash.gg/tournament/${eventToCheck.tournamentSlug}/event/${eventToCheck.slug}/entrant/${eventToCheck.entrantId}`,
//         '.profileContents .tourney-content .AttendeeDetailsPage div div div div div section + section div div div > a'
//       )
//     ).map(async el => await (await el.getProperty('href')).jsonValue())

//     const urls = await Promise.all(puppeteerEventPromises)
//     const relevantURLs = urls.filter(
//       url =>
//         url.indexOf('/tournament/') > -1 &&
//         url.indexOf('/event/') > -1 &&
//         url.indexOf('/entrant/') > -1
//     )
//     let newPuppeteerEvents = relevantURLs.map(url => {
//       const [
//         wholeString,
//         tournamentSlug,
//         eventSlug,
//       ] = /\/tournament\/([^/]*)\/event\/([^/]*)/g.exec(url)
//       return {
//         service: 'smashgg',
//         tournamentSlug,
//         eventSlug,
//       }
//     })
//     newPuppeteerEvents = await Promise.all(
//       newPuppeteerEvents.map(async e => {
//         const isNew = await isUnknownEvent(e)
//         if (isNew) return e
//       })
//     )
//     newPuppeteerEvents = newPuppeteerEvents.filter(e => e)
//     console.log(
//       newPuppeteerEvents.length,
//       'additional events found via puppeteer for player',
//       player.tag
//     )
//     foundEvents.push(...newPuppeteerEvents)
//   }
// }
