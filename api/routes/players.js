const { Router } = require('express')
const router = Router()
const logger = require('../data/scripts/log')
const log = logger('api', 'gray')

const get = require('../data/get')
const updateManager = require('../data/updateManager')

router.get('/test', (req, res) => {
  res.json({ test: 'success' })
})

/* GET stats */
router.get('/stats', async (req, res, next) => {
  log(req.ip, 'db stats')
  const stats = await get.dbStats()
  res.json(stats)
})

/* GET player with points by game and tag. */
router.get('/points/:game/tag/:tag', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const tag = decodeURIComponent(req.params.tag)
  log(req.ip, 'player with points by tag:', tag)
  const foundPoints = await get.player({ game, tag, setActive: true })
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
  log(req.ip, 'player with points by id:', id)
  const foundPoints = await get.player({ game, id, setActive: true })
  if (foundPoints) {
    res.json(foundPoints)
  } else {
    res.json({ err: 'No player in database by that id.' })
  }
})

/* GET get manually added event data */
router.get(
  '/event/:service/:game/:tournamentSlug/:eventSlug',
  handleEvent
)
router.get('/event/:service/:game/:tournamentSlug', handleEvent)
async function handleEvent(req, res, next) {
  log(req.ip, 'event by url')
  const service = decodeURIComponent(req.params.service)
  const game = decodeURIComponent(req.params.game)
  const tournamentSlug = decodeURIComponent(req.params.tournamentSlug)
  const eventSlug = req.params.eventSlug
    ? decodeURIComponent(req.params.eventSlug)
    : undefined
  const eventData = await get.event({
    service,
    tournamentSlug,
    eventSlug,
    game,
  })
  res.json(eventData)
}

/* GET more events for player */
router.get('/more/:game/:id/', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const id = parseInt(decodeURIComponent(req.params.id))
  log(req.ip, 'more events for player', id)
  get.logToDb('more')
  const moreEvents = await get.moreEventsForPlayer({
    game,
    id,
  })
  res.json(moreEvents)
})

/* GET combine all instances of a tag into one id */
router.get('/combine/:game/:tag/:id/', async (req, res, next) => {
  log(req.ip, 'combining ids')
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

/* GET run new event scan from admin panel */
let lastScan = 0
const minimumScanInterval = 3 * 60 * 60 * 1000
router.get('/scan/', async (req, res, next) => {
  if (
    req.ip !== '127.0.0.1' &&
    Date.now() - lastScan < minimumScanInterval
  ) {
    res.json({ complete: false })
    return log('skipping scan (last was too recent)')
  }
  log(req.ip, 'starting scan')
  lastScan = Date.now()
  get.logToDb('scan')
  await updateManager.scanForNewEvents()
  res.json({ complete: true })
})

/* GET run rolling update from admin panel */
let lastRolling = 0
const minimumRollingInterval = 1 * 60 * 1000
router.get('/rolling/', async (req, res, next) => {
  if (
    req.ip !== '127.0.0.1' &&
    Date.now() - lastRolling < minimumRollingInterval
  ) {
    res.json({ complete: false })
    return log('skipping rolling update (last was too recent)')
  }
  log(req.ip, 'starting rolling update')
  lastRolling = Date.now()
  get.logToDb('rolling')
  await updateManager.rollingUpdate()
  res.json({ complete: true })
})

module.exports = router
