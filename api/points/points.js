const { getPlacingRatio } = require('../../common/functions').default
const db = require('../db/firebaseClient')

module.exports = {
  async get(player, onlyTouchEventId, loadedPlayers) {
    let points = []

    const chronologicalEvents = (
      player.participatedInEvents || []
    ).sort((a, b) => a.date - b.date)

    points.push(
      ...(await eventPoints(
        chronologicalEvents,
        player,
        onlyTouchEventId,
        loadedPlayers
      ))
    )

    return points
  },
}

async function eventPoints(
  events,
  player,
  onlyTouchEventId,
  loadedPlayers
) {
  let runningPlacingAverage
  let lastEventDate
  return await events.reduce(
    async (collectedPoints, event, index) => {
      if (onlyTouchEventId && event.id !== onlyTouchEventId) {
        return collectedPoints
      }

      const points = []
      const p = makePointElementGenerator(points, event)

      // todo test this. doesn't seem to work?
      if (event.ownerId === player.id)
        p({
          title: `Hosted a Tournament`,
          context: `Hell yeah, someone's got to`,
          value: 20 + Math.floor(event.totalParticipants / 30),
          date: event.date,
        })

      if (index === 0)
        runningPlacingAverage =
          event.standing / event.totalParticipants
      else
        runningPlacingAverage =
          (runningPlacingAverage * index +
            event.standing / event.totalParticipants) /
          (index + 1)

      p({
        title: `Played in a Tournament`,
        context: `With ${event.totalParticipants} players`,
        value: 10 + Math.floor(event.totalParticipants / 40),
        date: event.date,
      })

      if (event.totalParticipants <= 15)
        p({
          title: `Supported the Local Scene`,
          context: `Attended a small tournament`,
          value: 5,
          date: event.date,
        })
      else if (event.totalParticipants >= 400)
        p({
          title: `Going Big Time`,
          context: `Attended a supermajor`,
          value: 10,
          date: event.date,
        })
      else if (event.totalParticipants >= 200)
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

      if (index === 0 && !onlyTouchEventId)
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
      else if (
        event.standing / event.totalParticipants <
        runningPlacingAverage
      )
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

      if (
        lastEventDate &&
        lastEventDate > event.date - 10 * 24 * 60 * 60 &&
        lastEventDate < event.date - 6 * 60 * 60
      )
        // less than 10 days, more than 6 hours
        p({
          title: `Consistent Attendence`,
          context: `Multiple events in 10 days`,
          value: 5,
          date: event.date,
        })
      lastEventDate = event.date

      const mps = await matchPoints(
        event.matchesWithUser,
        event,
        events,
        player,
        loadedPlayers
      )
      points.push(...(await mps))

      return [...(await collectedPoints), ...(await points)]
    },
    []
  )
}

async function matchPoints(
  matches,
  event,
  events,
  player,
  loadedPlayers
) {
  const chronologicalMatches = matches.sort((a, b) => a.date - b.date)
  let winStreak = 0,
    inLosers = false

  return await chronologicalMatches.reduce(
    async (pointsArray, match) => {
      const points = []
      const p = makePointElementGenerator(points, event, match.date)

      const didWin = match.winnerTag === player.tag
      let wonGames = match[didWin ? 'winnerScore' : 'loserScore']
      if (!wonGames || wonGames < 0) wonGames = 0
      let lostGames = match[didWin ? 'loserScore' : 'winnerScore']
      if (!lostGames || lostGames < 0) lostGames = 0

      if (didWin && lostGames > 0)
        p({
          category: `Progression`,
          title: `Clinched a Close Set`,
          context: `${wonGames}-${lostGames} vs. %O`,
          opponent: {
            tag: match.loserTag,
            id: match.loserId,
            img: match.loserImg,
          },
          value: 4,
        })
      else if (didWin)
        p({
          category: `Progression`,
          title: `Won a Set`,
          context: `vs. %O`,
          opponent: {
            tag: match.loserTag,
            id: match.loserId,
            img: match.loserImg,
          },
          value: 4,
        })
      else if (wonGames > 0)
        p({
          category: `Progression`,
          title: `Played a Close Set`,
          context: `${wonGames}-${lostGames} vs. %O`,
          opponent: {
            tag: match.winnerTag,
            id: match.winnerId,
            img: match.winnerImg,
          },
          value: 3,
        })
      else
        p({
          title: `Played a Set`,
          context: `vs. %O`,
          opponent: {
            tag: match.winnerTag,
            id: match.winnerId,
            img: match.winnerImg,
          },
          value: 2,
        })
      if (didWin) winStreak++
      else {
        winStreak = 0
        inLosers = true
      }
      if (winStreak > 2)
        p({
          title: `Hot Streak`,
          context: `${winStreak} wins in a row`,
          value: winStreak,
        })
      if (winStreak > 2 && inLosers)
        p({
          title: `Losers' Bracket Run`,
          context: `${winStreak} wins after a loss`,
          value: 2,
        })

      const opponentId = didWin ? match.loserId : match.winnerId
      const opponentTag = didWin ? match.loserTag : match.winnerTag
      let opponentData = loadedPlayers.find(p => p.id === opponentId)
      if (
        !opponentData ||
        opponentData.redirect ||
        !opponentData.participatedInEvents
      )
        opponentData = await db.getPlayerById(player.game, opponentId)

      if (!opponentData || !opponentData.participatedInEvents)
        return [...(await pointsArray), ...points]
      const opponentRatio = getPlacingRatio(opponentData)
      const opponentInThisTournament = opponentData.participatedInEvents.find(
        e => e.id === event.id
      )
      // if (!opponentInThisTournament)
      //   console.log(
      //     'no data found for this tournament!',
      //     opponentTag,
      //     opponentId,
      //     '@',
      //     event.name,
      //     event.tournamentName,
      //     event.id
      //   )
      if (
        opponentInThisTournament &&
        (opponentInThisTournament.standing <= 2 ||
          opponentInThisTournament.standing /
            opponentInThisTournament.totalParticipants <
            opponentRatio - 0.15)
      )
        p({
          title: `Opponent Was On Fire`,
          context: `${opponentTag} placed much better than normal`,
          value: 2,
        })
      if (
        opponentRatio < getPlacingRatio(player) - 0.15 &&
        opponentData.participatedInEvents.length > 2
      ) {
        p({
          category: `Progression`,
          title: `Up a Weight Class`,
          context: `${opponentTag} usually places higher than you`,
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
        opponentRatio < 0.3 &&
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
          oe =>
            oe.eventSlug === e.eventSlug &&
            oe.tournamentSlug === oe.tournamentSlug
        )
      )
      const sharedMatches = sharedEvents.reduce(
        (matchesInCommon, { matchesWithUser }) => [
          ...matchesInCommon,
          ...matchesWithUser.filter(
            m =>
              m.winnerTag === opponentTag ||
              m.loserTag === opponentTag
          ),
        ],
        []
      )
      const pastMatches = sharedMatches.filter(
        match => match.date <= event.date
      )

      if (pastMatches.length >= 10)
        p({
          title: `Old Rivals`,
          context: `You've played against ${opponentTag} ${pastMatches.length} times`,
          value: 1,
        })

      const winPercentUpToAndIncludingEvent =
        pastMatches.reduce(
          (wonCount, m) =>
            wonCount + (m.winnerTag === player.tag ? 1 : 0),
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
    },
    []
  )
}

function makePointElementGenerator(
  pointsAccumulator,
  event,
  useDate
) {
  return ({
    category = 'Participation',
    title,
    context,
    opponent,
    value,
    date = useDate || event.date,
  }) => {
    const newPoint = {
      category,
      title,
      context,
      value,
      date,
      eventSlug: event.eventSlug,
      eventName: event.name,
      tournamentSlug: event.tournamentSlug,
      tournamentName: event.tournamentName,
    }
    if (opponent) newPoint.opponent = opponent
    pointsAccumulator.push(newPoint)
  }
}
