const logger = require('./log')
const low = logger('memory', 'gray')
const log = logger('memory', 'white')
const logAdd = logger('memory', 'green')
const logInfo = logger('memory', 'blue')
const logError = logger('memory', 'yellow')

module.exports = function(percentCutoff) {
  const memory = process.memoryUsage()
  const memoryUsedPercent = memory.heapUsed / memory.rss
  if (memoryUsedPercent > percentCutoff) {
    logError(
      'Low on memory!',
      Math.round(memory.heapUsed / 1024 / 1024),
      'mb of',
      Math.round(memory.rss / 1024 / 1024),
      'mb'
    )
    return false
  }
  return true
}
