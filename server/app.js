const app = require('express')()
const server = require('http').createServer(app)
require('./io/io')(server)

app.set('trust proxy', true)

// Import API Routes
app.use('/api', require('./routes/api'))

module.exports = {
  app,
  server,
}
