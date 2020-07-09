const axios = require('axios')

const silent = () => {}
const logger = require('../../scripts/log')
const log = logger('smashggq', 'gray')
const low = silent //logger('smashggq', 'gray')
const logAdd = logger('smashggq', 'green')
const logError = logger('smashggq', 'yellow')

const rateLimiter = require('../../scripts/rateLimiter')
const limiter = new rateLimiter(12, 10000)
const perSetQueryPage = 14
const perStandingQueryPage = 70

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
  // log(request)
  return limiter.queue(() => {
    return axios(request).catch(error => {
      logError(
        'axios error:',
        error.response
          ? error.response.data
            ? error.response.data.message
            : error.response.status
          : error,
      )
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
      owner {
        id
      }
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
        slots {
          standing {
            placement
            stats {
              score {
                value
              }
            }
          }
          entrant {
            participants {
              player {
                id
                gamerTag
              }
              user {
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
    sets(
      page: 1, 
      perPage: 220, 
      filters: { hideEmpty: true }
    ) {
      nodes {
        event {
          state
          slug
          videogame {
            name
          }
          tournament {
            owner {
              id
            }
            slug
          }
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
      perPage:  ${perSetQueryPage},
      sortType: STANDARD
      filters: {
        hideEmpty: true
      }
    ) {
      nodes {
        completedAt
        slots {
          standing {
            placement
            stats {
              score {
                value
              }
            }
          }
          entrant {
            participants {
              user {
                images {
                 url
                }
              }
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

const queryEventStandings = `
query EventStandings($slug: String, $page: Int!) {
  event(slug: $slug) {
    standings (query: {
      page: $page,
      perPage: ${perStandingQueryPage}
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
            }
            user {
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
  perSetQueryPage,
  perStandingQueryPage,
}
