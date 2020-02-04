const { Router } = require('express')
const router = Router()
const logger = require('../data/scripts/log')
const log = logger('api', 'gray')

const get = require('../data/get')

router.get('/test', (req, res) => {
  res.json({ test: 'success' })
})

/* GET stats */
router.get('/stats', async (req, res, next) => {
  log('db stats')
  const stats = await get.dbStats()
  res.json(stats)
})

/* GET players listing. */
router.get('/players/:game', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  log('all players for', game)
  const players = await get.players({ game })
  res.json(players)
})

/* GET player by game and tag. */
router.get('/player/:game/:tag', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const tag = decodeURIComponent(req.params.tag)
  log('player:', tag)
  const foundPlayer = await get.player({ game, tag })
  if (foundPlayer) {
    res.json(foundPlayer)
  } else {
    res.json({ err: 'No player in database by that tag.' })
  }
})

/* GET player with points by game and tag. */
router.get('/points/:game/tag/:tag', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const tag = decodeURIComponent(req.params.tag)
  log('player with points by tag:', tag)
  const foundPoints = await get.points({ game, tag })
  if (foundPoints) {
    res.json(foundPoints)
  } else {
    res.json({ err: 'No player in database by that tag.' })
  }
})

/* GET player with points by game and id. */
router.get('/points/:game/id/:id', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const id = parseInt(decodeURIComponent(req.params.id))
  log('player with points by id:', id)
  const foundPoints = await get.points({ game, id })
  if (foundPoints) {
    res.json(foundPoints)
  } else {
    res.json({ err: 'No player in database by that id.' })
  }
})

/* GET get manually added event data */
router.get(
  '/event/:service/:game/:tournamentSlug/:eventSlug',
  async (req, res, next) => {
    log('manually added event')
    const service = decodeURIComponent(req.params.service)
    const game = decodeURIComponent(req.params.game)
    const tournamentSlug = decodeURIComponent(
      req.params.tournamentSlug
    )
    const eventSlug = decodeURIComponent(req.params.eventSlug)
    const eventData = await get.event({
      service,
      tournamentSlug,
      slug: eventSlug,
      game,
    })
    res.json(eventData)
  }
)

/* GET more events for player */
router.get('/more/:game/:id/', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const id = parseInt(decodeURIComponent(req.params.id))
  log('more events for player', id)
  get.logToDb('more')
  const moreEventStubs = await get.moreEventsForPlayer({
    game,
    id,
  })
  const newEvents = []
  await Promise.all(
    moreEventStubs.map(async stub => {
      const eventData = await get.event({
        service: stub.service,
        tournamentSlug: stub.tournamentSlug,
        slug: stub.eventSlug,
        game,
      })
      newEvents.push(eventData)
    })
  )
  res.json(newEvents)
})

/* GET combine all instances of a tag into one id */
router.get('/combine/:game/:tag/:id/', async (req, res, next) => {
  log('combining ids')
  get.logToDb('combine')
  const game = decodeURIComponent(req.params.game)
  const tag = decodeURIComponent(req.params.tag)
  const id = parseInt(decodeURIComponent(req.params.id))
  const didRedirect = await get.combineTag({
    game,
    tag,
    id,
  })
  res.json({ id: didRedirect })
})

// setTimeout(test, 6000)

// async function test() {
//   const event = await get.event({
//     service: 'smashgg',
//     tournamentSlug: 'the-dojo-s-sunday-smash-18',
//     slug: 'ultimate-singles',
//   })

//   // log(
//   //   'points',
//   //   await get.points({
//   //     game: 'Super Smash Bros. Ultimate',
//   //     tag: 'Christian',
//   //   })
//   // )

//   const moreEvents = await get.moreEventsForPlayer({
//     game: 'Super Smash Bros. Ultimate',
//     id: 1185494,
//     // entrantId: 4170895,
//   })
//   log(moreEvents)

//   if (!moreEvents) return log(`No additional events found.`)
//   moreEvents.forEach(
//     async event =>
//       await get.event({
//         service: event.service,
//         tournamentSlug: event.tournamentSlug,
//         slug: event.eventSlug,
//       })
//   )
// }

module.exports = router
