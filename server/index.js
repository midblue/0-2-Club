require('dotenv').config()

const { app, server } = require('./app')

const { Nuxt, Builder } = require('nuxt')
const config = require('../nuxt.config.js')
config.dev = process.env.NODE_ENV !== 'production'

async function start() {
  const nuxt = new Nuxt(config)

  const { host, port } = nuxt.options.server

  if (config.dev) {
    const builder = new Builder(nuxt)
    await builder.build()
  } else {
    await nuxt.ready()
  }

  app.use(nuxt.render)

  server.listen(port, () => {
    console.log(`Server listening on http://${host}:${port}`)
  })
}
start()
