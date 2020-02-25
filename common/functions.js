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
    if (ip.substring('66.249.64.') === 0) return 'Google'
    return ip
  },

  gameTitle,
}

function gameTitle(query) {
  const unambiguousTitle = gameTitleDisambiguation.find(d => d(query))
  if (unambiguousTitle) {
    return unambiguousTitle(query)
  }
  return query
}

/* official game titles: */
const gameTitleDisambiguation = [
  // Super Smash Bros. Melee
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?M(?:elee\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Melee'
    return false
  },

  // Super Smash Bros. Ultimate
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?U(?:ltimate\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Ultimate'
    return false
  },

  // Super Smash Bros. Brawl
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?B(?:rawl\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Brawl'
    return false
  },

  // Super Smash Bros.
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros.'
    return false
  },
]
