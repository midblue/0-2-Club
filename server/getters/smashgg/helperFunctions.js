const { parseParticipantTag, gameTitle } = require('../../../common/functions')

const silent = () => {}
const logger = require('../../scripts/log')
const log = logger('smashgg', 'gray')
const low = silent //logger('smashgg', 'gray')
const logAdd = logger('smashgg', 'green')
const logError = logger('smashgg', 'yellow')

module.exports = {
  isComplete(event) {
    if (event.state !== 'COMPLETED') return false
    if (event.sets && event.sets.nodes && event.sets.nodes.length > 0) {
      for (let set of event.sets.nodes) {
        if (
          !set.slots[0].standing.placement ||
          set.slots[0].standing.placement < 1 ||
          set.slots[0].standing.placement > 2
        ) {
          return false
        }
      }
    }
    return true
  },

  isSingles(event) {
    // melee-singles smash-at-york-15-melee-wii-u-singles-waseda-doubles
    // melee-singles mini-smash-at-york-melee-wii-u-singles-doubles
    const hasNumbers = /(?:[２３４234][ -]?(?:vs?|on|対)[ -]*[２３４234]|do?u?b(?:le)?[sz]|team[sz])/gi
    if (hasNumbers.exec(event.slug || event.eventSlug || '')) return false
    if (hasNumbers.exec(event.name || '')) return false
    if (
      event.name &&
      event.sets &&
      event.sets.nodes &&
      event.sets.nodes.length > 0
    ) {
      let isProbablyDoubles = 0
      for (let c = 0; c < 6; c++) {
        const randomSetNumber = Math.floor(
          Math.random() * event.sets.nodes.length,
        )
        const set = event.sets.nodes[randomSetNumber]
        if (set.slots.find(s => s.standing.placement > 2)) return false // 3 or more players
        if (
          // slashes in participant names
          parseParticipantTag(
            set.slots[0].entrant.participants[0].player.gamerTag,
          ).indexOf('/') > -1 ||
          parseParticipantTag(
            set.slots[1].entrant.participants[0].player.gamerTag,
          ).indexOf('/') > -1
        )
          isProbablyDoubles++
      }
      if (isProbablyDoubles >= 3) return false
    }
    return true
  },

  parseEventStubsFromTournaments(tournaments, game) {
    return tournaments.reduce((eventsAccumulator, tournament) => {
      const tournamentEvents =
        tournament.events && tournament.events.length
          ? tournament.events
              .filter(
                event =>
                  (!game ||
                    gameTitle(event.videogame.name) === gameTitle(game)) &&
                  event.state === 'COMPLETED' &&
                  event.sets.nodes &&
                  event.sets.nodes.length > 0,
              )
              .map(event => {
                const [
                  wholeString,
                  tournamentSlug,
                  eventSlug,
                ] = /tournament\/([^/]*)\/event\/([^/]*)/g.exec(
                  event.slug || event.eventSlug,
                )
                return {
                  service: 'smashgg',
                  eventSlug,
                  tournamentSlug,
                  game: gameTitle(event.videogame.name),
                }
              })
          : []
      return [...eventsAccumulator, ...tournamentEvents]
    }, [])
  },
}
