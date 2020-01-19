const cachedPoints = {}

module.exports = {
  async get(player) {
    const points = []

    const chronologicalEvents = player.participatedInEvents.sort(
      (a, b) => a.date - b.date
    )
    points.push(...eventPoints(chronologicalEvents, player))

    return points
  },
}

function eventPoints(events, player) {
  const points = []
  let runningPlacingAverage, totalPlacings

  events.forEach((event, index) => {
    points.push({
      category: `Participation`,
      title: `Played in a Tournament`,
      context: `With ${event.totalParticipants} players`,
      value: 10 + Math.floor(event.totalParticipants / 10),
      date: event.date,
      eventSlug: event.slug,
      eventName: event.name,
      tournamentSlug: event.tournamentSlug,
      tournamentName: event.tournamentName,
    })

    if (index === 0)
      points.push({
        category: `Progression`,
        title: `First Event`,
        context: `For ${player.game}`,
        value: 20,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    else if (event.standing / event.totalParticipants < runningPlacingAverage)
      points.push({
        category: `Progression`,
        title: `Placed Better than Average`,
        context: `Top ${(
          (event.standing / event.totalParticipants) *
          100
        ).toFixed(0)}th percentile`,
        value: 10,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    else if (
      event.standing / event.totalParticipants >
      runningPlacingAverage + 0.2
    )
      points.push({
        category: `Participation`,
        title: `Tough Tournament`,
        context: `You'll get 'em next time`,
        value: 2,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })

    if (event.standing === 1) {
      points.push({
        category: `Progression`,
        title: `Won the Tournament`,
        context: `First place!`,
        value: 20,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    } else if (event.standing === 2) {
      points.push({
        category: `Progression`,
        title: `Runner Up`,
        context: `So close!`,
        value: 15,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    } else if (event.standing / event.totalParticipants <= 0.1) {
      points.push({
        category: `Progression`,
        title: `Top 10%`,
        context: `${event.standing} of ${event.totalParticipants}`,
        value: 10,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    } else if (event.standing / event.totalParticipants <= 0.25) {
      points.push({
        category: `Progression`,
        title: `Top 25%`,
        context: `${event.standing} of ${event.totalParticipants}`,
        value: 5,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    } else if (event.standing / event.totalParticipants <= 0.5) {
      points.push({
        category: `Progression`,
        title: `Top 50%`,
        context: `${event.standing} of ${event.totalParticipants}`,
        value: 3,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    }

    points.push(...matchPoints(event.matchesWithUser, event, events, player))

    if (index === 0)
      runningPlacingAverage = event.standing / event.totalParticipants
    else
      runningPlacingAverage =
        (runningPlacingAverage * index +
          event.standing / event.totalParticipants) /
        (index + 1)
  })
  return points
}

function matchPoints(matches, event, events, player) {
  return []
  const points = []
  matches.forEach(match => {
    if (match.winner.tag === player.tag)
      points.push({
        category: `Progression`,
        title: `Won a match`,
        context: `Against ${match.loser.tag}`,
        value: 5,
        date: match.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    else
      points.push({
        category: `Participation`,
        title: `Played a match`,
        context: `Against ${match.winner.tag}`,
        value: 3,
        date: match.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
  })
  return points
}
