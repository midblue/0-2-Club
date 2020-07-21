const logger = require('../scripts/log')
const log = logger('prep', 'white')
const low = logger('prep', 'gray')
const logAdd = logger('prep', 'green')
const logError = logger('prep', 'yellow')

module.exports = {
  makeNewPlayerToSaveFromEvent(event, participant) {
    return {
      game: event.game,
      id: participant.id,
      tag: participant.tag,
      img: participant.img,
      redirect: false,
      peers: [],
      points: [],
      participatedInEvents: [
        this.makeParticipantDataToSaveFromEvent(event, participant),
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
      eventSlug: event.eventSlug,
      tournamentSlug: event.tournamentSlug,
      tournamentName: event.tournamentName,
      ownerId: event.ownerId,
      matchesWithUser: event.sets.filter(
        s => s.winnerTag === participant.tag || s.loserTag === participant.tag,
      ),
    }
  },

  stripUnnecessaryEventData(event) {
    //* turns out we don't actually NEED sets etc.
    return {
      id: event.id,
      img: event.img,
      game: event.game,
      date: event.date,
      service: event.service,
      eventSlug: event.eventSlug,
      name: event.name,
      tournamentSlug: event.tournamentSlug,
      tournamentName: event.tournamentName,
      ownerId: event.ownerId,
      participants: event.participants.map(
        ({ img, id, standing, of, tag }) => ({ img, id, standing, of, tag }),
      ),
    }
  },

  collatePointsIntoPlayerData(player) {
    if (!player || !player.points) return
    const collatedEvents = (player.participatedInEvents || []).map(event => {
      const eventDataWithPoints = {
        ...event,
        points: (player.points || []).filter(
          point =>
            point.eventSlug === event.eventSlug &&
            point.tournamentSlug === event.tournamentSlug,
        ),
      }
      eventDataWithPoints.points = eventDataWithPoints.points.map(point => {
        delete point.eventSlug
        delete point.tournamentSlug
        return point
      })
      return eventDataWithPoints
    })
    delete player.points
    player.participatedInEvents = collatedEvents
    return player
  },

  parsePlayerDisambiguation(foundPlayer) {
    if (!foundPlayer || !Array.isArray(foundPlayer)) return foundPlayer
    if (foundPlayer.length === 1) return foundPlayer[0]
    else if (foundPlayer.length > 1) {
      logError(
        'found multiple players in the database by the tag',
        foundPlayer[0].tag,
        'for',
        foundPlayer[0].game,
      )
      return foundPlayer.sort(
        (a, b) => b.participatedInEvents.length - a.participatedInEvents.length,
      )
    }
  },

  pruneUndefined(obj) {
    if (Array.isArray(obj)) {
      return obj.filter(el => el !== undefined)
    } else if (typeof obj === 'object')
      Object.keys(obj).map(key => {
        if (obj[key] === undefined) delete obj[key]
        else obj[key] = this.pruneUndefined(obj[key])
      })
    return obj
  },
}
