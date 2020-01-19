const $$ = require('./selectorOnPage')
const smashgg = require('smashgg.js')
const { Event, VideoGame, Tournament, Phase, User, Attendee } = smashgg
smashgg.initialize(process.env.SMASHGG_APIKEY)
winston = {}

module.exports = {
  async event({ tournamentSlug, slug }) {
    if (!(tournamentSlug && slug)) return

    let eventData
    if (tournamentSlug && slug)
      eventData = await Event.get(tournamentSlug, slug)
    const tournamentData = await Tournament.get(tournamentSlug)

    // todo check for error

    const eventId = await eventData.getId()
    const eventName = await eventData.getName()
    const eventSlug = /.*\/([^/]*)$/gi.exec(await eventData.getSlug())[1]
    const isDone = eventData.getState() === 'COMPLETED'
    const tournamentName = await tournamentData.getName()
    const tournamentId = await tournamentData.getId()
    tournamentSlug = /.*\/([^/]*)$/gi.exec(await tournamentData.getSlug())[1]

    if (!isDone) return { err: 'not done' }

    const game = await (
      await $$(
        `https://smash.gg/tournament/${tournamentSlug}/events/${eventSlug}/overview`,
        'section div div div div div div div div div span'
      )
    )[2].evaluate(node => node.innerText)

    const rawStandings = await eventData.getStandings()
    const participants = rawStandings.map(s => ({
      standing: s.getPlacement(),
      of: rawStandings.length,
      tag: parseParticipantTag(s.entrant.getName()),
      entrantId: s.entrant.id,
    }))

    const rawSets = await eventData.getSets()
    const sets = rawSets
      .map(s => {
        const winner =
          s.player1.entrantId === s.winnerId ? s.player1 : s.player2
        const loser = s.player2.entrantId === s.winnerId ? s.player1 : s.player2
        return {
          date: s.completedAt,
          winner: {
            tag: parseParticipantTag(
              winner.tag ||
                participants.find(p => p.entrantId === winner.entrantId).tag
            ),
            score: s.player1.entrantId === s.winnerId ? s.score1 : s.score2,
          },
          loser: {
            tag: parseParticipantTag(
              loser.tag ||
                participants.find(p => p.entrantId === loser.entrantId).tag
            ),
            score: s.player1.entrantId === s.winnerId ? s.score2 : s.score1,
          },
        }
      })
      .filter(s => s)

    // console.log(eventId, participants, sets)

    return {
      id: eventId,
      name: eventName,
      slug: eventSlug,
      game,
      date: eventData.startAt,
      service: 'smashgg',
      tournament: {
        id: tournamentId,
        slug: tournamentSlug,
        name: tournamentName,
      },
      participants,
      sets,
    }
  },

  async moreEventsForPlayer({ entrantId, eventSlug, tournamentSlug }) {
    if (!entrantId || !eventSlug) return
    const eventPromises = await (
      await $$(
        `https://smash.gg/tournament/${tournamentSlug}/event/${eventSlug}/entrant/${entrantId}`,
        '.profileContents .tourney-content .AttendeeDetailsPage div div div div div section + section div div div > a'
      )
    ).map(async el => await (await el.getProperty('href')).jsonValue())

    const urls = await Promise.all(eventPromises)
    const relevantURLs = urls.filter(url => /\/entrant\//g.exec(url))
    const events = relevantURLs.map(url => {
      const [
        wholeString,
        ts,
        es,
      ] = /\/tournament\/([^/]*)\/event\/([^/]*)/g.exec(url)
      return {
        service: 'smashgg',
        tournamentSlug: ts,
        eventSlug: es,
      }
    })
    return events
  },
}

function parseParticipantTag(name) {
  const minusTeam = /(?:.* | )?(.*)$/gi.exec(name)
  return minusTeam[1]
}
