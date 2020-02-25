require('dotenv').config()

const express = require('express')
const timeout = require('connect-timeout')

// Create express instance
const app = express()

app.set('trust proxy', true)

// Require API routes
const api = require('./routes/api')

// Import API Routes
app.use(api)

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
