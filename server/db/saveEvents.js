const updatePlayersPointsAndPeers = require('./updatePlayersPointsAndPeers')
const db = require('./firebaseClient')
const prep = require('./dbDataPrep')

const io = require('../io/io')()

const logger = require('../scripts/log')
const low = logger('saveevents', 'gray')
const log = logger('saveevents', 'white')
const logAdd = logger('saveevents', 'green')
const logInfo = logger('saveevents', 'blue')
const logError = logger('saveevents', 'yellow')

/*

Adds a single event or many events to the database,
and then adds/updates all of its players (quick points)

CAN NOT handle events from multiple games at once

*/

module.exports = async function(newEvents) {
  if (!Array.isArray(newEvents)) newEvents = [newEvents]
  const game = newEvents[0].game
  const uniqueParticipants = []

  newEvents = newEvents.filter(e => e && e.participants)

  for (let e of newEvents) {
    uniqueParticipants.push(
      ...e.participants.filter(
        participant =>
          !uniqueParticipants.find(player => player.id === participant.id),
      ),
    )
  }

  for (let event of newEvents) await db.addEvent(event)

  const batchSize = 30
  let currentBatchOfParticipants = uniqueParticipants.splice(0, batchSize)
  let totalNew = 0,
    totalUpdated = 0

  while (currentBatchOfParticipants.length) {
    let newPlayersCount = 0
    let players = await Promise.all(
      currentBatchOfParticipants.map(async p => {
        const foundPlayer = await db.getPlayerById(game, p.id)
        if (foundPlayer) return foundPlayer
        newPlayersCount++
        return { id: p.id }
      }),
    )
    totalNew += newPlayersCount
    totalUpdated += players.length - newPlayersCount

    for (let event of newEvents) {
      let skipDouble = 0

      event.participants.forEach(participant => {
        const player = players.find(
          p => participant.id === p.redirect || participant.id === p.id,
        )

        let newPlayerData = {}
        if (!player) return // will be handled on another pass
        if (!player.tag) {
          // is new
          newPlayerData = prep.makeNewPlayerToSaveFromEvent(event, participant)
        } else {
          // existing player
          // todo also grab image, tag, etc? (or only if is most recent event for player)
          const newParticipantData = prep.makeParticipantDataToSaveFromEvent(
            event,
            participant,
          )
          if (
            player.participatedInEvents.find(
              e => e.id === newParticipantData.id,
            )
          )
            skipDouble++
          else {
            newPlayerData.participatedInEvents = [
              ...player.participatedInEvents,
              newParticipantData,
            ]
          }
        }
        for (let key of Object.keys(newPlayerData))
          player[key] = newPlayerData[key]
      })

      if (skipDouble)
        logError(
          'skipped double adding participant data for',
          skipDouble,
          `players (event ${event.name} @ ${event.tournamentName})`,
        )
    }

    // while we're here, go ahead and do the BASIC points for these players.
    // this will also save the new & updated player data for us.
    // we force update so that new players still get added.
    await updatePlayersPointsAndPeers(
      players,
      true,
      newEvents.map(e => e.id),
      true,
    )

    currentBatchOfParticipants = uniqueParticipants.splice(0, batchSize)
  }

  io.to(`${game}`).emit('newEvents', newEvents)
  logAdd(`updated ${totalUpdated} and added ${totalNew} players`)
}
