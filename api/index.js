const express = require('express')

// Create express instance
const app = express()

// Require API routes
const players = require('./routes/players')

// Import API Routes
app.use(players)

// Export the server middleware
module.exports = {
  path: '/api',
  handler: app,
}
