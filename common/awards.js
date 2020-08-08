const { getPlacingRatio } = require('./functions')

// ? awards for:
// lifetime total x unique opponents
// x total rivals / rivals beat

module.exports = function(player) {
  if (!player || !player.participatedInEvents) return []

  // ! getting WEIRD error here trying to sort these on combined players
  // const chronologicalEvents = player.participatedInEvents.sort(
  //   (a, b) => a.date - b.date
  // )
  // so here's a workaround, no idea why it works
  const orderedDates = player.participatedInEvents
    .map(e => e.date)
    .sort((a, b) => a - b)
  const chronologicalEvents = orderedDates
    .map(d => player.participatedInEvents.find(e => e.date === d))
    .map(e => ({ ...e, name: e.name.replace(/ fe?a?tu?r?i?n?g?\.? .*/gi, '') }))

  const awards = getAwards(player, chronologicalEvents)

  return awards
}

function getAwards(player, events) {
  return [
    ...bestStreak(player, events),
    ...totalGameWins(player, events),
    ...totalPodiumFinishes(player, events),
    ...totalFirstPlaces(player, events),
    ...mostWeeksInARow(player, events),
    ...eventsInASeries(player, events),
    ...mostInOneWeek(player, events),
    ...yearlyImprovement(player, events),
    ...majors(player, events),
    ...yearlyAttendance(player, events),
  ]
}

/*

award format

title
level (0 = in progress, -1 = not started)
levelStart
levelEnd
levelProgress
bestAttemptString
levelDescription
requirements
img
label (for bottom center of icon)
points

*/

// won tournaments
function bestStreak(player, events) {
  const bestStreak = (events || [])
    .reduce(
      (points, e) => [
        ...points,
        ...e.points.map(p => ({
          ...p,
          tournamentName: e.tournamentName,
          date: e.date,
        })),
      ],
      [],
    )
    .reduce(
      (highest, point) => {
        if (point.context.indexOf('wins in a row') > -1) {
          const wins = parseInt(
            point.context.substring(0, point.context.indexOf(' ')),
          )
          if (wins > highest.total)
            return {
              total: wins,
              date: point.date,
              name: point.tournamentName,
            }
        }
        return highest
      },
      { total: 0 },
    )
  const levels = [0, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30, 40, 1000]

  const title = `Streakin'`
  const total = bestStreak.total

  let level = levels.findIndex(l => total < l) - 1
  if (total === 0) level = -1 // not started

  const levelStart = levels[level] || 0,
    levelEnd = levels[level + 1],
    levelProgress = total / levelEnd
  // levelProgress = (total - levelStart) / (levelEnd - levelStart)

  const bestAttemptString = `Best: ${total} on ${new Date(
    bestStreak.date * 1000,
  ).toLocaleDateString()}`

  const levelDescription = `Won <span style="font-weight: bold; color:var(--l${level});">${total}</span> set${
    total === 1 ? '' : 's'
  } in a row at ${bestStreak.name} on ${new Date(
    bestStreak.date * 1000,
  ).toLocaleDateString()}`

  const requirements = `Level 1: Win <span style="font-weight: bold;">${levels[1]}</span> sets in a row`

  const img = '/img/awards/streak.png'

  const label = ``

  const points = level * 10

  if (level < 1) return []
  return [
    {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    },
  ]
}

function majors(player, events) {
  const majorCutoff = 200
  const majors = events.reduce((total, event) => {
    return total + (event.totalParticipants >= majorCutoff ? 1 : 0)
  }, 0)

  const levels = [0, 1, 2, 5, 10, 18, 30, 50, 75, 110, 150, 200, 300, 1000]

  const title = `Major Competitor`
  const total = majors

  let level = levels.findIndex(l => total < l) - 1
  if (total === 0) level = -1 // not started

  const levelStart = levels[level] || 0,
    levelEnd = levels[level + 1],
    levelProgress = total / levelEnd

  const bestAttemptString = ``

  const levelDescription = `Attended <span style="font-weight: bold; color:var(--l${level});">${total}</span> major${
    total === 1 ? '' : 's'
  }`

  const requirements = `Level 1: Participate in a major (at least ${majorCutoff} players)`

  const img = '/img/awards/majors.png'

  const label = ``

  const points = level * 10

  if (level < 1) return []
  return [
    {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    },
  ]
}

function totalGameWins(player, events) {
  const totalGameWins = events.reduce((total, event) => {
    return (
      total +
      event.matchesWithUser.reduce((total, match) => {
        if (match.winnerId === player.id)
          return total + (match.winnerScore || 2)
        else
          return (
            total +
            (match.loserScore && match.loserScore >= 0 ? match.loserScore : 0)
          )
      }, 0)
    )
  }, 0)
  const levels = [
    0,
    10,
    25,
    50,
    100,
    200,
    400,
    800,
    1600,
    3200,
    6400,
    12800,
    25600,
  ]

  const title = `Winning!`
  const total = totalGameWins

  let level = levels.findIndex(l => totalGameWins < l) - 1
  if (totalGameWins < 1) level = -1 // not started

  const levelStart = levels[level] || 0,
    levelEnd = levels[level + 1],
    levelProgress = totalGameWins / levelEnd

  const bestAttemptString = `Current: ${totalGameWins}`

  const levelDescription = `Won <span style="font-weight: bold; color:var(--l${level});">${totalGameWins}</span> total game${
    totalGameWins === 1 ? '' : 's'
  }`

  const requirements = `Level 1: Win <span style="font-weight: bold;">${levels[1]}</span> total games`

  const img = '/img/awards/totalwins.png'

  const label = ``

  const points = level * 10

  if (level < 1) return []
  return [
    {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    },
  ]
}

function totalPodiumFinishes(player, events) {
  const totalPodiumFinishes = events.reduce(
    (total, event) => total + (event.standing <= 3 ? 1 : 0),
    0,
  )
  const levels = [0, 1, 3, 6, 10, 18, 30, 45, 70, 100, 150, 200, 1000]

  const title = `Podium Position`
  const total = totalPodiumFinishes

  let level = levels.findIndex(l => totalPodiumFinishes < l) - 1
  if (totalPodiumFinishes < 1) level = -1 // not started

  const levelStart = levels[level] || 0,
    levelEnd = levels[level + 1],
    levelProgress = totalPodiumFinishes / levelEnd

  const bestAttemptString = `Current: ${totalPodiumFinishes}`

  const levelDescription = `Placed in the top 3 <span style="font-weight: bold; color:var(--l${level});">${totalPodiumFinishes}</span> time${
    totalPodiumFinishes === 1 ? '' : 's'
  }`

  const requirements = `Level 1: Place in the top 3 <span style="font-weight: bold;">${
    levels[1]
  }</span> time${levels[1] === 1 ? '' : 's'}`

  const img = '/img/awards/podium.png'

  const label = ``

  const points = level * 10

  if (level < 1) return []
  return [
    {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    },
  ]
}

function totalFirstPlaces(player, events) {
  const totalFirstPlaces = events.reduce(
    (total, event) => total + (event.standing === 1 ? 1 : 0),
    0,
  )
  const levels = [0, 1, 2, 4, 7, 10, 15, 20, 30, 50, 75, 100, 1000]

  const title = `Number One`
  const total = totalFirstPlaces

  let level = levels.findIndex(l => totalFirstPlaces < l) - 1
  if (totalFirstPlaces < 1) level = -1 // not started

  const levelStart = levels[level] || 0,
    levelEnd = levels[level + 1],
    levelProgress = totalFirstPlaces / levelEnd

  const bestAttemptString = `Current: ${totalFirstPlaces}`

  const levelDescription = `Won <span style="font-weight: bold; color:var(--l${level});">${totalFirstPlaces}</span> tournament${
    totalFirstPlaces === 1 ? '' : 's'
  }`

  const requirements = `Level 1: Win a tournament <span style="font-weight: bold;">${
    levels[1]
  }</span> time${levels[1] === 1 ? '' : 's'}`

  const img = '/img/awards/championships.png'

  const label = ``

  const points = level * 10

  if (level < 1) return []
  return [
    {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    },
  ]
}

function mostWeeksInARow(player, events) {
  const aWeek = 9 * 24 * 60 * 60 // give a little leeway for daily rescheduling
  const mostWeeksInARow = events.reduce((max, event, index) => {
    const start = event.date
    let end = event.date
    let currentEventIndex = index,
      currentEvent = events[currentEventIndex]

    while (currentEvent && currentEvent.date - end < aWeek) {
      end = currentEvent.date
      currentEventIndex++
      currentEvent = events[currentEventIndex]
    }
    const totalWeeksInARow = Math.ceil((end - start) / aWeek)
    if (max.total > totalWeeksInARow) return max
    return {
      total: totalWeeksInARow,
      start,
    }
  }, 0)
  const levels = [0, 3, 4, 5, 7, 9, 12, 20, 30, 52, 65, 85, 104, 1000]

  const title = `Weekly Warrior`
  const total = mostWeeksInARow.total

  let level = levels.findIndex(l => total < l) - 1
  if (total < 1) level = -1 // not started

  const levelStart = levels[level] || 0,
    levelEnd = levels[level + 1],
    levelProgress = total / levelEnd

  const bestAttemptString = `Best: ${total} on ${new Date(
    mostWeeksInARow.start * 1000,
  ).toLocaleDateString()}`

  const levelDescription = `Attended events <span style="font-weight: bold; color:var(--l${level});">${total}</span> week${
    total === 1 ? '' : 's'
  } in a row, starting on ${new Date(
    mostWeeksInARow.start * 1000,
  ).toLocaleDateString()}`

  const requirements = `Attend an event for at least <b>${levels[1]}</b> consecutive weeks`

  const img = '/img/awards/weeksinarow.png'

  const label = ``

  const points = level * 10

  if (level < 1) return []
  return [
    {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    },
  ]
}

function eventsInASeries(player, events) {
  const seriesCounts = events.reduce((totals, event, index) => {
    const seriesName = event.tournamentName
      .toLowerCase()
      .replace(/[\d+=.,\s\/_–—<>()#\-]/gi, '')
    if (seriesName.length < 3) return totals
    if (!totals[seriesName]) totals[seriesName] = []
    totals[seriesName].push(event)
    return totals
  }, {})

  const longestSeries = Object.values(seriesCounts).reduce(
    (highest, series) => {
      // todo skip multiple events that happened on the same day/weekend
      return series.length > highest.length ? series : highest
    },
    [],
  )
  if (longestSeries.length === 0) return []
  const longestSeriesName = longestSeries[0].tournamentName
    .replace(/[#\d]/gi, '')
    .replace(/\s*$/g, '')

  const levels = [0, 3, 4, 5, 7, 9, 12, 20, 30, 52, 65, 85, 130, 1000]

  const title = `Series Regular`
  const total = longestSeries.length

  let level = levels.findIndex(l => total < l) - 1
  if (total < 1) level = -1 // not started

  const levelStart = levels[level] || 0,
    levelEnd = levels[level + 1],
    levelProgress = total / levelEnd

  const bestAttemptString = `Best: ${total} times at ${longestSeriesName}`

  const levelDescription = `Attended <span style="font-weight: bold; color:var(--l${level});">${longestSeriesName} ${total}</span> time${
    total === 1 ? '' : 's'
  }`

  const requirements = `Attend a series <b>${levels[1]}</b> times`

  const img = '/img/awards/series.png'

  const label = ``

  const points = level * 10

  if (level < 1) return []
  return [
    {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    },
  ]
}

function mostInOneWeek(player, events) {
  const aWeek = 7 * 24 * 60 * 60
  const mostInOneWeek = events.reduce((max, event, index) => {
    const start = event.date
    let currentEventIndex = index,
      totalEventsInAWeek = 0,
      currentEvent = events[currentEventIndex]

    while (currentEvent && currentEvent.date - start < aWeek) {
      totalEventsInAWeek++
      currentEventIndex++
      currentEvent = events[currentEventIndex]
    }
    if (max.total > totalEventsInAWeek) return max
    return {
      total: totalEventsInAWeek,
      start,
    }
  }, 0)

  const levels = [0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 15, 20, 30, 1000]

  const title = `Training Mode`
  const total = mostInOneWeek.total

  let level = levels.findIndex(l => total < l) - 1
  if (total < 1) level = -1 // not started

  const levelStart = levels[level] || 0,
    levelEnd = levels[level + 1],
    levelProgress = total / levelEnd

  const bestAttemptString = `Best: <b>${total}</b> on ${new Date(
    mostInOneWeek.start * 1000,
  ).toLocaleDateString()}`

  const levelDescription = `Attended <span style="font-weight: bold; color:var(--l${level});">${total}</span> event${
    total === 1 ? '' : 's'
  } in one week, starting on ${new Date(
    mostInOneWeek.start * 1000,
  ).toLocaleDateString()}`

  const requirements = `Attend at least <b>${levels[1]}</b> events in one week`

  const img = '/img/awards/mostinoneweek.png'

  const label = ``

  const points = level * 10

  if (level < 1) return []
  return [
    {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    },
  ]
}

function yearlyImprovement(player, events) {
  const eventsUntilThisPoint = []
  const cumulativePlacingRatiosByYear = {}
  for (let event of events) {
    eventsUntilThisPoint.push(event)
    const placingRatio = getPlacingRatio(eventsUntilThisPoint)
    const eventDate = new Date(event.date * 1000)
    const year = eventDate.getFullYear()
    const month = eventDate.getMonth()
    if (!cumulativePlacingRatiosByYear[year]) {
      // skip if there's not enough time left in the year & this is the first event (October)
      if (month > 9) continue
      cumulativePlacingRatiosByYear[year] = {
        start: placingRatio,
        end: placingRatio,
      }
    } else cumulativePlacingRatiosByYear[year].end = placingRatio
  }

  Object.keys(cumulativePlacingRatiosByYear).forEach(year => {
    cumulativePlacingRatiosByYear[year].improvement =
      cumulativePlacingRatiosByYear[year].start -
      cumulativePlacingRatiosByYear[year].end
  })

  const levels = [
    0,
    5,
    7.5,
    10,
    12.5,
    15,
    17.5,
    20,
    22.5,
    25,
    35,
    50,
    75,
    100,
    1000,
  ]

  const awards = Object.keys(cumulativePlacingRatiosByYear).map(year => {
    const isCurrentYear = new Date().getFullYear() === year,
      improvedPercent = Math.ceil(
        cumulativePlacingRatiosByYear[year].improvement * 100,
      )

    const title = `${year} Improvement`
    const total = improvedPercent

    let level = levels.findIndex(l => improvedPercent < l) - 1
    if (
      !level ||
      improvedPercent <= 0 ||
      (!isCurrentYear && improvedPercent < levels[1])
    )
      level = -1 // not started

    const levelStart = levels[level] || 0,
      levelEnd = levels[level + 1],
      levelProgress = improvedPercent / levelEnd

    const bestAttemptString = `Current: <b>${improvedPercent}%</b> improved placing in ${year}`

    const levelDescription = `Average placing improved <span style="font-weight: bold; color:var(--l${level});">${Math.round(
      improvedPercent,
    )}%</span> in ${year}`

    const requirements = `Improve average placing by at least <b>${levels[1]}%</b> over the year`

    const img = '/img/awards/yearplacing.png'

    const label = `'${`${year}`.substring(2)}`

    const points = level * 10

    if (level < 1) return
    return {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    }
  })

  return awards.filter(a => a)
}

function yearlyAttendance(player, events) {
  const eventsPerYear = {}
  for (let event of events) {
    const year = new Date(event.date * 1000).getFullYear()
    eventsPerYear[year] = (eventsPerYear[year] || 0) + 1
  }

  const levels = [0, 4, 8, 12, 16, 20, 24, 28, 32, 40, 50, 65, 80, 100, 1000]

  const awards = Object.keys(eventsPerYear).map(year => {
    const isCurrentYear = new Date().getFullYear() === year

    const title = `${year} Activity`
    const total = eventsPerYear[year]

    let level = levels.findIndex(l => total < l) - 1
    if (!level || total <= 0 || (!isCurrentYear && total < levels[1]))
      level = -1 // not started

    const levelStart = levels[level] || 0,
      levelEnd = levels[level + 1],
      levelProgress = total / levelEnd

    const bestAttemptString = `Current: <b>${total}%</b> events this year`

    const levelDescription = `Participated in <span style="font-weight: bold; color:var(--l${level});">${total}</span> events in ${year}`

    const requirements = `Attend at least <b>${levels[1]}%</b> this year`

    const img = '/img/awards/yearattendance.png'

    const label = `'${`${year}`.substring(2)}`

    const points = level * 10

    if (level < 1) return
    return {
      title,
      total,
      level,
      levelStart,
      levelEnd,
      levelProgress,
      bestAttemptString,
      levelDescription,
      requirements,
      img,
      label,
      points,
    }
  })

  return awards.filter(a => a)
}
