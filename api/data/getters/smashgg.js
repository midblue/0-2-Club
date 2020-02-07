const axios = require('axios')

const { parseParticipantTag } = require('../../../common/f').default

const silent = () => {}
const logger = require('../scripts/log')
const log = logger('smashgg', 'white')
const low = logger('smashgg', 'gray')
const logAdd = logger('smashgg', 'green')
const logError = logger('smashgg', 'yellow')

const rateLimiter = require('../scripts/rateLimiter')
const limiter = new rateLimiter(12, 10000)

const currentlyLoadingNewEvents = []

const perQueryPage = 100

module.exports = {
  async event({ tournamentSlug, slug, eventSlug }) {
    if (eventSlug && !slug) slug = eventSlug
    if (!(tournamentSlug && slug)) return

    if (
      currentlyLoadingNewEvents.find(e => e === tournamentSlug + slug)
    )
      logError(
        'already loading this event! load queue length:',
        currentlyLoadingNewEvents.length
      )
    else currentlyLoadingNewEvents.push(tournamentSlug + slug)
    // log(currentlyLoadingNewEvents)

    const eventData = await getEvent(tournamentSlug, slug)
    if (!eventData || eventData.error)
      return logError(`skipping event:`, eventData.error)
    const isDone = eventData.state === 'COMPLETED'
    if (!isDone) return { err: 'not done' }

    const participants = eventData.standings.nodes.map(s => ({
      standing: s.placement,
      of: eventData.standings.nodes.length,
      tag: parseParticipantTag(
        s.entrant.participants[0].player.gamerTag
      ),
      id: s.entrant.participants[0].player.id,
      entrantId: s.entrant.id,
      img:
        s.entrant.participants[0].player.images.length > 0
          ? s.entrant.participants[0].player.images[0].url
          : false,
    }))

    const sets = (eventData.sets.nodes || [])
      .map(s => {
        const player1 = {
            id: s.slots[0].entrant.participants[0].player.id,
            entrantId: s.slots[0].entrant.id,
            tag: parseParticipantTag(
              s.slots[0].entrant.participants[0].player.gamerTag
            ),
            score: s.entrant1Score,
            img:
              s.slots[0].entrant.participants[0].player.images
                .length > 0
                ? s.slots[0].entrant.participants[0].player.images[0]
                    .url
                : false,
          },
          player2 = {
            id: s.slots[1].entrant.participants[0].player.id,
            entrantId: s.slots[1].entrant.id,
            tag: parseParticipantTag(
              s.slots[1].entrant.participants[0].player.gamerTag
            ),
            score: s.entrant2Score,
            img:
              s.slots[1].entrant.participants[0].player.images
                .length > 0
                ? s.slots[1].entrant.participants[0].player.images[0]
                    .url
                : false,
          }
        const winner =
          player1.entrantId === s.winnerId ? player1 : player2
        const loser =
          winner.entrantId === player2.entrantId ? player1 : player2
        delete winner.entrantId
        delete loser.entrantId
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
      tournamentSlug,
      tournamentName: eventData.tournament.name,
      ownerId: eventData.tournament.ownerId,
      participants,
      sets,
    }
  },

  async moreEventsForPlayer(
    player,
    ownerIdsToCheck,
    existingEvents,
    onlyFromGame
  ) {
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

        const existsInDb = existingEvents
          ? existingEvents.find(
              existingEvent =>
                existingEvent.tournamentSlug === tournamentSlug &&
                existingEvent.slug === eventSlug &&
                existingEvent.service === 'smashgg'
            )
          : false
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
      // todo we really can't get MORE?
      let sets
      if (!res.data.data.player) {
        logError(
          `Failed to get recent sets for player ${
            player.id
          } on smashgg. (${JSON.stringify(
            res.data.error ||
              res.data.data.error ||
              res.data.data.errors,
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
              (onlyFromGame &&
                set.event.videogame.name !== onlyFromGame) ||
              set.slots.length > 2
            )
              return resolve()
            const [
              wholeString,
              tournamentSlug,
              eventSlug,
            ] = /tournament\/([^/]*)\/event\/([^/]*)/g.exec(
              set.event.slug
            )
            const isNew = await isUnknownEvent({
              tournamentSlug,
              eventSlug,
            })
            if (isNew) {
              ownersFoundFromRecentSets.push(
                set.event.tournament.ownerId
              )
              resolve({
                service: 'smashgg',
                tournamentSlug,
                eventSlug,
                game: set.event.videogame.name,
              })
            } else resolve()
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
      if (newPlayerSetEvents.length > 0)
        log(
          newPlayerSetEvents.length,
          'additional event/s found via api for player',
          player.tag
        )
      else low('no new events found via api for player', player.tag)

      ownersFoundFromRecentSets = Array.from(
        new Set(ownersFoundFromRecentSets)
      )
      if (ownersFoundFromRecentSets.length > 0)
        log(
          `found ${ownersFoundFromRecentSets.length} owner/s from recent sets`
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
        ])
      )

    log(
      ownerIds.length,
      'owner/s found to check —',
      ownerIdsToCheck ? 'preset' : 'organic'
    )
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
              `Failed to get data for ownerId ${ownerId} on smashgg, retrying... (attempt ${attempts})`
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
          onlyFromGame
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
        if (newEvents.length > 0)
          log(
            newEvents.length,
            'additional event/s found via owner',
            ownerId
          )
        else low('no new events found via owner', ownerId)

        return newEvents
      })
    )
    eventsFromOwnerIds.forEach(eventList =>
      foundEvents.push(...eventList)
    )

    // if (foundEvents.length > 0)
    //   logAdd(
    //     'found additional events:\n                        ',
    //     foundEvents
    //       .map(e => e.tournamentSlug + ' - ' + e.eventSlug)
    //       .join('\n                         ')
    //   )
    return foundEvents
  },
}

async function getEvent(tournamentSlug, eventSlug) {
  let data,
    attempts = 0
  while (!data) {
    if (attempts > 4) return { error: 'tried too many times' }
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
        `Failed to get data for ${tournamentSlug} - ${eventSlug} on smashgg, retrying... (attempt ${attempts})`
        // (${JSON.stringify(
        //   data.error || data.data.error || data.data.errors || data.data,
        //   null,
        //   2
        // )})`
      )
      attempts++
      data = null
    } else data = data.data.data.event
  }
  if (!isSingles(data)) return { error: 'not singles' }

  data.sets.nodes = []
  data.standings.nodes = []

  const totalSetNumber = data.sets.pageInfo.totalPages,
    totalStandingNumber = data.standings.pageInfo.totalPages

  const totalSetPages = Math.ceil(totalSetNumber / perQueryPage),
    totalStandingPages = Math.ceil(totalStandingNumber / perQueryPage)

  let allSets = []
  for (
    let currentSetsPage = 1;
    currentSetsPage <= totalSetPages;
    currentSetsPage++
  ) {
    allSets.push(
      new Promise(async resolve => {
        low(
          'getting sets page',
          currentSetsPage,
          'for',
          `${tournamentSlug} - ${eventSlug}`
        )
        let moreSets
        while (!moreSets) {
          moreSets = await makeQuery(queryEventSets, {
            page: currentSetsPage,
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
              currentSetsPage,
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
            moreSets = null
          }
        }
        moreSets = moreSets.data.data.event.sets.nodes
        return resolve(moreSets)
      })
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
        low(
          'getting standings page',
          currentStandingsPage,
          'for',
          `${tournamentSlug} - ${eventSlug}`
        )
        let moreStandings
        while (!moreStandings) {
          moreStandings = await makeQuery(queryEventStandings, {
            page: currentStandingsPage,
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
            moreStandings = null
          }
        }
        moreStandings = moreStandings.data.data.event.standings.nodes
        return resolve(moreStandings)
      })
    )
  }

  allSets = await Promise.all(allSets)
  allSets = [].concat.apply([], allSets)
  data.sets.nodes = allSets

  allStandings = await Promise.all(allStandings)
  allStandings = [].concat.apply([], allStandings)
  data.standings.nodes = allStandings

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
  if (
    event.name &&
    event.sets &&
    event.sets.nodes &&
    event.sets.nodes.length > 0
  ) {
    let isProbablyDoubles = 0
    for (let c = 0; c < 6; c++) {
      const set =
        event.sets.nodes[
          Math.floor(Math.random() * event.sets.nodes.length)
        ]
      if (!set.winnerId) {
        return false
      }
      if (
        parseParticipantTag(
          set.slots[0].entrant.participants[0].player.gamerTag
        ).indexOf('/') > -1 ||
        parseParticipantTag(
          set.slots[1].entrant.participants[0].player.gamerTag
        ).indexOf('/') > -1
      )
        isProbablyDoubles++
    }
    if (isProbablyDoubles >= 3) return false
  }
  return true
}

function isNotAlreadyLoading(event) {
  return !currentlyLoadingNewEvents.find(
    e => e === event.tournamentSlug + (event.slug || event.eventSlug)
  )
}

async function parseEventStubsFromTournaments(tournaments, game) {
  return tournaments.reduce((eventsAccumulator, tournament) => {
    const tournamentEvents =
      tournament.events && tournament.events.length
        ? tournament.events
            .filter(
              event =>
                (!game || event.videogame.name === game) &&
                event.state === 'COMPLETED' &&
                event.sets.nodes &&
                event.sets.nodes.length > 0
            )
            .map(event => {
              const [
                wholeString,
                tournamentSlug,
                eventSlug,
              ] = /tournament\/([^/]*)\/event\/([^/]*)/g.exec(
                event.slug
              )
              return {
                service: 'smashgg',
                eventSlug,
                tournamentSlug,
                game: event.videogame.name,
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
      perPage: 1
    }) {
      pageInfo {
        totalPages
      }
      nodes {
        id
        placement
        entrant {
          id
          participants {
            player {
              id
              gamerTag
            }
          }
        }
      }
    }
    sets(
      page: $page,
      perPage: 1,
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
            participants {
              player {
                id
                gamerTag
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
        videogame {
          name
          slug
        }
        tournament {
          id
          ownerId
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
      perPage:  ${perQueryPage},
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
            participants {
              player {
                id
                gamerTag
                images {
                  url
                }
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
      perPage: ${perQueryPage}
    }) {
      nodes {
        id
        placement
        entrant {
          id
          participants {
            player {
              id
              gamerTag
              images {
                url
              }
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
      perPage: 100
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
