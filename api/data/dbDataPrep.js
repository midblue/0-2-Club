const logger = require('./scripts/log')
const log = logger('prep', 'white')
const low = logger('prep', 'gray')
const logAdd = logger('prep', 'green')
const logError = logger('prep', 'yellow')

module.exports = {
  // todo check if already exists in db
  makePlayersToSaveFromEvent(event) {
    return event.participants.map(p => ({
      game: event.game,
      id: p.id,
      tag: p.tag,
      redirect: false,
      // todo check redirects...
      participatedInEvents: [
        {
          date: event.date,
          standing: p.standing,
          totalParticipants: p.of,
          service: event.service,
          id: event.id,
          name: event.name,
          slug: event.slug,
          tournamentSlug: event.tournamentSlug,
          tournamentName: event.tournamentName,
          ownerId: event.ownerId,
          matchesWithUser: event.sets.filter(
            s => s.winnerTag === p.tag || s.loserTag === p.tag
          ),
        },
      ],
    }))
  },

  makeNewPlayerToSaveFromEvent(event, participant) {
    return {
      game: event.game,
      id: participant.id,
      tag: participant.tag,
      redirect: false,
      peers: [],
      points: [],
      participatedInEvents: [
        {
          date: event.date,
          standing: participant.standing,
          totalParticipants: participant.of,
          service: event.service,
          id: event.id,
          name: event.name,
          slug: event.slug,
          tournamentSlug: event.tournamentSlug,
          tournamentName: event.tournamentName,
          ownerId: event.ownerId,
          matchesWithUser: event.sets.filter(
            s =>
              s.winnerTag === participant.tag ||
              s.loserTag === participant.tag
          ),
        },
      ],
    }
  },

  makeParticipantDataToSaveFromEvent(event, participant) {
    return {
      date: event.date,
      standing: participant.standing,
      totalParticipants: participant.of,
      service: event.service,
      id: event.id,
      name: event.name,
      slug: event.slug,
      tournamentSlug: event.tournamentSlug,
      tournamentName: event.tournamentName,
      ownerId: event.ownerId,
      matchesWithUser: event.sets.filter(
        s =>
          s.winnerTag === participant.tag ||
          s.loserTag === participant.tag
      ),
    }
  },

  parsePlayerDisambiguation(foundPlayer) {
    if (!foundPlayer || !Array.isArray(foundPlayer))
      return foundPlayer
    if (foundPlayer.length === 1) return foundPlayer[0]
    else if (foundPlayer.length > 1) {
      logError(
        'found multiple players in the database by the tag',
        foundPlayer[0].tag,
        'for',
        foundPlayer[0].game
      )
      return foundPlayer.sort(
        (a, b) =>
          b.participatedInEvents.length -
          a.participatedInEvents.length
      )
    }
  },
}
