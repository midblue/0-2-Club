require('dotenv').config()

const express = require('express')
const timeout = require('connect-timeout')

// Create express instance
const app = express()

// Require API routes
const players = require('./routes/players')

// Import API Routes
app.use(players)

app.use(timeout(360000))
app.use(haltOnTimedout)
function haltOnTimedout(req, next) {
  if (!req.timedout) next()
}

// Export the server middleware
module.exports = {
  path: '/api',
  handler: app,
}
