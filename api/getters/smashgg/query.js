const axios = require('axios')

const silent = () => {}
const logger = require('../../scripts/log')
const log = logger('smashgg', 'gray')
const low = silent //logger('smashgg', 'gray')
const logAdd = logger('smashgg', 'green')
const logError = logger('smashgg', 'yellow')

const rateLimiter = require('../../scripts/rateLimiter')
const limiter = new rateLimiter(12, 10000)
const perQueryPage = 100

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

const queryEvent = `
query EventInfo($slug: String, $page: Int!) {
  event(slug: $slug) {
    id
    name
    slug
    state
    startAt
    images {
      url
    }
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

const queryEventsInTournament = `
query EventsInfo($slug: String) {
  tournament(slug: $slug) {
    name
    events {
			name
			id
			slug
			videogame {
				name
				slug
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

module.exports = {
  makeQuery,
  queryEvent,
  queryEventSets,
  queryEventStandings,
  queryPlayerSets,
  queryTournamentsByOwner,
  queryEventsInTournament,
  perQueryPage,
}
