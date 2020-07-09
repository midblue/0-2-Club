const ipFilters = require('./vars/ips')
const gameTitleDisambiguation = require('./vars/gameTitles')

module.exports = {
  parseParticipantTag(name) {
    const minusTeam = /^(?:[^|]*(?: *[|]+ *)+)?(.*)$/gi.exec(name)
    return minusTeam ? minusTeam[1] : null
  },

  getPlacingRatio(events) {
    const eventsToUse = events.participatedInEvents
      ? events.participatedInEvents
      : events
    if (!Array.isArray(eventsToUse)) {
      console.log(
        'common functions — invalid events passed in to get placing ratio:',
        eventsToUse,
      )
      return 0.7
    }
    return (
      eventsToUse.reduce(
        (total, event) => total + event.standing / event.totalParticipants,
        0,
      ) / eventsToUse.length
    )
  },

  parseIp(req) {
    const ip = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(/, /)[0]
      : req.connection.remoteAddress || req.socket.remoteAddress
    let isAllowed = true,
      knownName,
      shouldLog = true
    for (let { regex, name, allowed, log } of ipFilters) {
      if (regex.exec(ip) === null) continue
      if (allowed === false) isAllowed = false
      if (log === false) shouldLog = false
      knownName = name
      break
    }
    return {
      ip,
      allowed: isAllowed,
      name: knownName,
      log: shouldLog,
    }
  },

  gameTitle(query) {
    const unambiguousTitle = gameTitleDisambiguation.find(d => d(query))
    if (unambiguousTitle) {
      return unambiguousTitle(query)
    }
    return query
  },
}
