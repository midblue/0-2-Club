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
    const p = makePointElementGenerator(points, event)

    // todo test
    if (event.ownerId === player.id)
      p({
        title: `Hosted a Tournament`,
        context: `Hell yeah, someone's got to`,
        value: 20 + Math.floor(event.totalParticipants / 30),
        date: event.date,
      })

    if (index === 0)
      runningPlacingAverage = event.standing / event.totalParticipants
    else
      runningPlacingAverage =
        (runningPlacingAverage * index +
          event.standing / event.totalParticipants) /
        (index + 1)

    p({
      title: `Played in a Tournament`,
      context: `With ${event.totalParticipants} players`,
      value: 10 + Math.floor(event.totalParticipants / 30),
      date: event.date,
    })

    if (event.totalParticipants <= 15)
      p({
        title: `Supported the Local Scene`,
        context: `Attended a small tournament`,
        value: 5,
        date: event.date,
      })
    else if (event.totalParticipants >= 300)
      p({
        title: `Going Big Time`,
        context: `Attended a supermajor`,
        value: 10,
        date: event.date,
      })
    else if (event.totalParticipants >= 100)
      p({
        title: `Going Big Time`,
        context: `Attended a major`,
        value: 5,
        date: event.date,
      })

    if (event.totalParticipants === 69)
      p({
        title: `${event.totalParticipants} players`,
        context: `Nice`,
        value: 6,
        date: event.date,
      })

    if (index === 0)
      p({
        category: `Progression`,
        title: `First Event`,
        context: `For ${player.game}`,
        value: 20,
        date: event.date,
      })
    else if (index === 1)
      p({
        category: `Progression`,
        title: `Sticking With It`,
        context: `Attended your second event`,
        value: 10,
        date: event.date,
      })
    else if (index === 2)
      p({
        category: `Progression`,
        title: `Sticking With It`,
        context: `Attended your third event`,
        value: 5,
        date: event.date,
      })
    else if (event.standing / event.totalParticipants < runningPlacingAverage)
      p({
        category: `Progression`,
        title: `Placed Better than Average`,
        context: `You're improving!`,
        value: 10,
        date: event.date,
      })
    else if (
      event.standing / event.totalParticipants >
      runningPlacingAverage + 0.2
    )
      p({
        title: `Tough Tournament`,
        context: `You'll get 'em next time`,
        value: 2,
        date: event.date,
      })

    if (event.standing === 1) {
      p({
        category: `Progression`,
        title: `Won the Tournament`,
        context: `First place!`,
        value: 20,
        date: event.date,
      })
    } else if (event.standing === 2) {
      p({
        category: `Progression`,
        title: `Runner-Up`,
        context: `Nice job!`,
        value: 15,
        date: event.date,
      })
    } else if (event.standing / event.totalParticipants <= 0.1) {
      p({
        category: `Progression`,
        title: `Top 10%`,
        context: `${event.standing} of ${event.totalParticipants}`,
        value: 10,
        date: event.date,
      })
    } else if (event.standing / event.totalParticipants <= 0.25) {
      p({
        category: `Progression`,
        title: `Top 25%`,
        context: `${event.standing} of ${event.totalParticipants}`,
        value: 8,
        date: event.date,
      })
    } else if (event.standing / event.totalParticipants <= 0.5) {
      p({
        category: `Progression`,
        title: `Top 50%`,
        context: `${event.standing} of ${event.totalParticipants}`,
        value: 5,
        date: event.date,
      })
    }

    // todo points for consistent event attendence

    const mps = await matchPoints(event.matchesWithUser, event, events, player)
    points.push(...mps)

    return [...(await collectedPoints), ...(await points)]
  }, [])
}

async function matchPoints(matches, event, events, player) {
  const chronologicalMatches = matches.sort((a, b) => a.date - b.date)
  return await chronologicalMatches.reduce(async (pointsArray, match) => {
    const points = []
    const p = makePointElementGenerator(points, event, match.date)

    const didWin = match.winner.tag === player.tag
    let wonGames = match[didWin ? 'winner' : 'loser'].score
    if (!wonGames || wonGames < 0) wonGames = 0
    let lostGames = match[didWin ? 'loser' : 'winner'].score
    if (!lostGames || lostGames < 0) lostGames = 0

    //todo points for win/lose streak
    if (didWin && lostGames > 0)
      p({
        category: `Progression`,
        title: `Clinched a Close Set`,
        context: `${wonGames}-${lostGames} vs.`,
        opponent: { tag: match.loser.tag, id: match.loser.id },
        value: 4,
      })
    else if (didWin)
      p({
        category: `Progression`,
        title: `Won a Set`,
        context: `vs.`,
        opponent: { tag: match.loser.tag, id: match.loser.id },
        value: 4,
      })
    else if (wonGames > 0)
      p({
        category: `Progression`,
        title: `Played a Close Set`,
        context: `${wonGames}-${lostGames} vs.`,
        opponent: { tag: match.winner.tag, id: match.winner.id },
        value: 3,
      })
    else
      p({
        title: `Played a Set`,
        context: `vs.`,
        opponent: { tag: match.winner.tag, id: match.winner.id },
        value: 2,
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
      p({
        category: `Progression`,
        title: `Up a Weight Class`,
        context: `${opponentTag} usually places better than you`,
        value: 2,
      })
      if (didWin) {
        p({
          category: `Progression`,
          title: `David & Goliath`,
          context: `You took down a giant!`,
          value: 10,
        })
      }
    } else if (
      getPlacingRatio(opponentData) < 0.3 &&
      opponentData.participatedInEvents.length > 2
    )
      p({
        category: `Progression`,
        title: `Strong Opponent`,
        context: `${opponentTag} usually places well`,
        value: 2,
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
    const pastMatches = sharedMatches.filter(match => match.date <= event.date)

    if (pastMatches.length >= 10)
      p({
        title: `Old Rivals`,
        context: `You played against ${opponentTag} ${pastMatches.length} times before`,
        value: 2,
      })

    const winPercentUpToAndIncludingEvent =
      pastMatches.reduce(
        (wonCount, m) => wonCount + (m.winner.tag === player.tag ? 1 : 0),
        0
      ) / pastMatches.length

    if (
      didWin &&
      pastMatches.length > 3 &&
      winPercentUpToAndIncludingEvent < 0.45
    )
      p({
        title: `Beat a Rival`,
        context: `You took down ${opponentTag}!`,
        value: 10,
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

function makePointElementGenerator(pointsAccumulator, event, useDate) {
  return ({
    category = 'Participation',
    title,
    context,
    opponent,
    value,
    date = useDate || event.date,
  }) =>
    pointsAccumulator.push({
      category,
      title,
      context,
      opponent,
      value,
      date,
      eventSlug: event.slug,
      eventName: event.name,
      tournamentSlug: event.tournamentSlug,
      tournamentName: event.tournamentName,
    })
}
