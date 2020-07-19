const points = require('../points/points')
const db = require('./firebaseClient')
const { gameTitle } = require('../../common/functions')
const prep = require('./dbDataPrep')

const logger = require('../scripts/log')
const low = logger('addevent', 'gray')
const log = logger('addevent', 'white')
const logAdd = logger('addevent', 'green')
const logInfo = logger('addevent', 'blue')
const logError = logger('addevent', 'yellow')

let loadedPlayers = {},
  clearLoadedPlayers = null

module.exports = async function(event, onlyUpdatePlayers = false) {
  clearTimeout(clearLoadedPlayers)

  // load players or lack thereof from db and place in-memory
  let players = await Promise.all(
    event.participants.map(async participantData => {
      let fromDb = null
      if (!loadedPlayers[participantData.id])
        fromDb = await db.getPlayer({
          game: gameTitle(event.game),
          id: participantData.id,
        })

      // check for redirect
      if (fromDb && fromDb.redirect)
        fromDb = await db.getPlayer({
          game: gameTitle(event.game),
          id: fromDb.redirect,
        })

      if (!loadedPlayers[participantData.id] && (!fromDb || !fromDb.error))
        loadedPlayers[participantData.id] = fromDb || {}

      loadedPlayers[participantData.id][
        'participantData' + event.id
      ] = participantData
      return loadedPlayers[participantData.id]
    }),
  )
  if (players.find(p => !p)) {
    return logError(
      `Failed to add event ${event.name} @ ${event.tournamentName}, firebase error (likely quota)`,
    )
  }
  clearTimeout(clearLoadedPlayers)

  let updatedExistingCount = 0

  // make full player data out of participants
  players = players.map(p => {
    if (
      !p.id ||
      !p.tag ||
      !p.participatedInEvents ||
      !p.participatedInEvents.length
    ) {
      // is new
      p = prep.makeNewPlayerToSaveFromEvent(
        event,
        p['participantData' + event.id],
      )
      loadedPlayers[p.id] = p
    } else {
      const eventParticipantData = prep.makeParticipantDataToSaveFromEvent(
        event,
        p['participantData' + event.id],
      )
      if (!loadedPlayers[p.id].participatedInEvents) {
        logError(
          `should have participatedInEvents but don't for`,
          loadedPlayers[p.id].tag,
          loadedPlayers[p.id].id,
          loadedPlayers[p.id],
        )
      }
      const alreadyExistsIndex = loadedPlayers[
        p.id
      ].participatedInEvents.findIndex(e => e.id === eventParticipantData.id)
      if (alreadyExistsIndex >= 0) {
        loadedPlayers[p.id].participatedInEvents[
          alreadyExistsIndex
        ] = eventParticipantData
        updatedExistingCount++
      } else {
        loadedPlayers[p.id].participatedInEvents.push(eventParticipantData)
      }
    }
    delete loadedPlayers[p.id]['participantData' + event.id]
    return loadedPlayers[p.id]
  })
  clearTimeout(clearLoadedPlayers)

  if (updatedExistingCount > 0)
    logError('updated participant data for', updatedExistingCount, `players`)

  // calculate points, as far as possible
  // * without access to All Players, only opponent points from THIS event are possible... so we only calculate ones from this event.
  await Promise.all(
    players.map(async player => {
      let newPoints = await points.get(player, event.id, players)
      player.points.push(...newPoints)
    }),
  )
  clearTimeout(clearLoadedPlayers)

  // * no peers for now, that'll also be handled in the rolling update. if they already had them, they stay the same for now.

  // onlyUpdatePlayers exists so that when we re-add an event after deleting it, we still have accurate player counts
  // todo this also breaks nonexistant players tho..?

  await Promise.all([
    db.addEvent(event),
    ...players
      .filter(
        p =>
          !onlyUpdatePlayers &&
          loadedPlayers[p.id].participatedInEvents.length <= 1,
      )
      .map(p => db.addPlayer(loadedPlayers[p.id])),
    ...players
      .filter(
        p =>
          onlyUpdatePlayers ||
          loadedPlayers[p.id].participatedInEvents.length > 1,
      )
      .map(p => db.updatePlayer(loadedPlayers[p.id])),
  ])
  logAdd(
    `done saving ${players.length} players' data for ${event.eventSlug} @ ${event.tournamentSlug}`,
  )

  clearTimeout(clearLoadedPlayers)
  clearLoadedPlayers = setTimeout(() => (loadedPlayers = {}), 600000)
}
