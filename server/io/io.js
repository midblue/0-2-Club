const logger = require('../scripts/log')
const low = logger('io', 'gray')
const log = logger('io', 'white')
const logAdd = logger('io', 'green')
const logInfo = logger('io', 'blue')
const logError = logger('io', 'yellow')

let io = null

module.exports = server => {
  if (io) return io
  if (!server) return {}
  const instantiatedIo = require('socket.io')(server)
  instantiatedIo.on('connection', socket => {
    socket.on('join', id => {
      low('watching', id)
      socket.join(id)
    })
    socket.on('leave', id => {
      socket.leave(id)
    })
  })

  io = instantiatedIo

  return io
}
