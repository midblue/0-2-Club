const logger = require('../scripts/log')
const low = logger('io_init', 'gray')
const log = logger('io_init', 'white')
const logAdd = logger('io_init', 'green')
const logInfo = logger('io_init', 'blue')
const logError = logger('io_init', 'yellow')

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
