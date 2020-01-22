const cachedPoints = {}
const db = require('../db/db.js')

module.exports = {
  async get(player) {
    const points = []

    const chronologicalEvents = player.participatedInEvents.sort(
      (a, b) => a.date - b.date
    )
    points.push(...(await eventPoints(chronologicalEvents, player)))

    return points
  },
}

async function eventPoints(events, player) {
  let runningPlacingAverage
  return await events.reduce(async (collectedPoints, event, index) => {
    const points = []
    points.push({
      category: `Participation`,
      title: `Played in a Tournament`,
      context: `With ${event.totalParticipants} players`,
      value: 10 + Math.floor(event.totalParticipants / 50),
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
        title: `Runner-Up`,
        context: `Nice job!`,
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
        value: 8,
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
        value: 5,
        date: event.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    }

    const mps = await matchPoints(event.matchesWithUser, event, events, player)
    points.push(...mps)

    if (index === 0)
      runningPlacingAverage = event.standing / event.totalParticipants
    else
      runningPlacingAverage =
        (runningPlacingAverage * index +
          event.standing / event.totalParticipants) /
        (index + 1)

    return [...(await collectedPoints), ...(await points)]
  }, [])
}

async function matchPoints(matches, event, events, player) {
  const chronologicalMatches = matches.sort((a, b) => a.date - b.date)
  return await chronologicalMatches.reduce(async (pointsArray, match) => {
    const points = []
    const didWin = match.winner.tag === player.tag
    if (didWin)
      points.push({
        category: `Progression`,
        title: `Won a Set`,
        context: `vs. ${match.loser.tag}`,
        value: 3,
        date: match.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    else
      points.push({
        category: `Participation`,
        title: `Played a Set`,
        context: `vs. ${match.winner.tag}`,
        value: 2,
        date: match.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })

    const opponentId = didWin ? match.loser.id : match.winner.id
    const opponentTag = didWin ? match.loser.tag : match.winner.tag
    const opponentData = await db.players.get({
      game: player.game,
      id: opponentId,
    })
    if (!opponentData) return [...(await pointsArray), ...points]
    if (
      getPlacingRatio(opponentData) < getPlacingRatio(player) - 0.15 &&
      opponentData.participatedInEvents.length > 2
    ) {
      points.push({
        category: `Progression`,
        title: `Up a Weight Class`,
        context: `${opponentTag} usually places better than you`,
        value: 3,
        date: match.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
      if (didWin) {
        points.push({
          category: `Progression`,
          title: `...You Actually Won!`,
          context: `Great job!`,
          value: 10,
          date: match.date,
          eventSlug: event.slug,
          eventName: event.name,
          tournamentSlug: event.tournamentSlug,
          tournamentName: event.tournamentName,
        })
      }
    } else if (
      getPlacingRatio(opponentData) < 0.3 &&
      opponentData.participatedInEvents.length > 2
    )
      points.push({
        category: `Progression`,
        title: `Strong Opponent`,
        context: `${opponentTag} usually places well`,
        value: 2,
        date: match.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })

    const sharedEvents = events.filter(e =>
      opponentData.participatedInEvents.find(
        oe => oe.slug === e.slug && oe.tournamentSlug === oe.tournamentSlug
      )
    )
    const sharedMatches = sharedEvents.reduce(
      (matchesInCommon, { matchesWithUser }) => [
        ...matchesInCommon,
        ...matchesWithUser.filter(
          m => m.winner.tag === opponentTag || m.loser.tag === opponentTag
        ),
      ],
      []
    )
    // todo dont give this for old matches too
    if (sharedMatches.length > 20)
      points.push({
        category: `Participation`,
        title: `Old Rivals`,
        context: `You've played against ${opponentTag} ${sharedMatches.length} times`,
        value: 2,
        date: match.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })

    const winPercent =
      sharedMatches.reduce(
        (wonCount, m) => wonCount + (m.winner.tag === player.tag ? 1 : 0),
        0
      ) / sharedMatches.length
    // todo don't cound future matches too in winPercent
    if (didWin && sharedMatches.length > 3 && winPercent < 0.5)
      points.push({
        category: `Participation`,
        title: `Beat a Rival`,
        context: `You took down ${opponentTag}!`,
        value: 10,
        date: match.date,
        eventSlug: event.slug,
        eventName: event.name,
        tournamentSlug: event.tournamentSlug,
        tournamentName: event.tournamentName,
      })
    return [...(await pointsArray), ...points]
  }, [])
}

function getPlacingRatio(player) {
  return (
    player.participatedInEvents.reduce(
      (total, event) => total + event.standing / event.totalParticipants,
      0
    ) / player.participatedInEvents.length
  )
}
