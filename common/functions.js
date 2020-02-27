export default {
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
        eventsToUse
      )
      return 0.7
    }
    return (
      eventsToUse.reduce(
        (total, event) =>
          total + event.standing / event.totalParticipants,
        0
      ) / eventsToUse.length
    )
  },

  parseIp(req) {
    const ip = req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(/, /)[0]
      : req.connection.remoteAddress || req.socket.remoteAddress
    let knownAllowed = true,
      knownName,
      knownLog = true
    for (let { regex, name, allowed } of ipFilters) {
      if (!regex.exec(ip)) continue
      if (allowed === false) knownAllowed = false
      if (log === false) knownLog = false
      knownName = name
      break
    }
    return {
      ip,
      allowed: knownAllowed,
      name: knownName,
      log: knownLog,
    }
  },

  gameTitle(query) {
    const unambiguousTitle = gameTitleDisambiguation.find(d =>
      d(query)
    )
    if (unambiguousTitle) {
      return unambiguousTitle(query)
    }
    return query
  },
}

const ipFilters = [
  {
    regex: /127\.0\.0\.1/g,
    name: 'localhost',
  },
  {
    regex: /^66\.249\./g,
    name: 'Google',
    log: false,
  },
  {
    regex: /118\.111\.157\.140/g,
    name: 'Me',
  },
  {
    regex: /216\.244\.66\.199/g,
    name: 'wowrack.com',
    allowed: false,
    log: false,
  },
]

/* official game titles */
const gameTitleDisambiguation = [
  // Super Smash Bros. Melee
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?M(?:elee\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Melee'
  },

  // Super Smash Bros. Ultimate
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?U(?:ltimate\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Ultimate'
  },

  // Super Smash Bros. Brawl
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?B(?:rawl\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Brawl'
  },

  // Super Smash Bros.
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros.'
  },
]
