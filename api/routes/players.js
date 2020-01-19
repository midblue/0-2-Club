const { Router } = require('express')
const router = Router()

const get = require('../data/get')

router.get('/test', (req, res) => {
  res.json({ test: 'success' })
})

/* GET players listing. */
router.get('/players/:game', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const players = await get.players({ game })
  res.json(players)
})

/* GET player by game and tag. */
router.get('/player/:game/:tag', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const tag = decodeURIComponent(req.params.tag)
  console.log(game, tag)
  const foundPlayer = await get.player({ game, tag })
  if (foundPlayer) {
    res.json(foundPlayer)
  } else {
    res.sendStatus(404)
  }
})

/* GET player with points by game and tag. */
router.get('/points/:game/:tag', async (req, res, next) => {
  const game = decodeURIComponent(req.params.game)
  const tag = decodeURIComponent(req.params.tag)
  console.log(game, tag)
  const foundPoints = await get.points({ game, tag })
  if (foundPoints) {
    res.json(foundPoints)
  } else {
    res.sendStatus(404)
  }
})

module.exports = router
