const logger = require('./scripts/log')
const log = logger('firebase', 'white')
const low = logger('firebase', 'gray')
const logAdd = logger('firebase', 'green')
const logError = logger('firebase', 'yellow')

const memo = require('./scripts/memo')
const prep = require('./dbDataPrep')

const admin = require('firebase-admin')
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(
        /\\n/g,
        '\n'
      ),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  })
}
const db = admin.firestore()

const statsRef = db.collection('stats').doc('default')
const gamesRef = db.collection('games')
const increment = admin.firestore.FieldValue.increment(1)
const decrement = admin.firestore.FieldValue.increment(-1)
let getSomeEventsStartingPoint, currentEventsCountedInRollingUpdate

const memoizedEvents = memo(300, 'events')
const memoizedKnownEventStubs = memo(2000, 'event stubs')
const memoizedPlayers = memo(300, 'players')

const aDayInSeconds = 24 * 60 * 60

const maxWrites = 20000,
  maxReads = 50000,
  maxDeletes = 20000
let writes = 0,
  reads = 0,
  deletes = 0,
  prevWrites = 0,
  prevReads = 0,
  prevDeletes = 0
setInterval(() => {
  if (
    writes !== prevWrites ||
    reads !== prevReads ||
    deletes !== prevDeletes
  )
    low(
      `today so far: ${writes} writes, ${reads} reads, ${deletes} deletes`
    )
  prevWrites = writes
  prevReads = reads
  prevDeletes = deletes
}, 100000)
setInterval(() => {
  writes = 0
  reads = 0
  deletes = 0
  prevWrites = 0
  prevReads = 0
  prevDeletes = 0
}, aDayInSeconds * 1000)

module.exports = {
  async getStats() {
    return statsRef.get().then(async doc => {
      const games = await this.getGames()
      reads++
      return { ...doc.data(), games }
    })
  },

  async getLimitProximity() {
    return {
      reads: reads / maxReads,
      writes: writes / maxWrites,
      deletes: deletes / maxDeletes,
    }
  },

  async updateActive(game, count) {
    await statsRef.update(
      {
        [`active.${game.replace(/\./g, '')}`]: count,
      },
      { merge: true }
    )
    writes++
  },

  async getGames() {
    return gamesRef
      .get()
      .then(snapshot => {
        reads += snapshot.docs.length || 0
        return snapshot.docs.map(doc => doc.id)
      })
      .catch(err => {
        logError('Error getting games', err)
      })
  },

  async getPlayer({ game, id, tag }) {
    if (!game) return
    if (id) return this.getPlayerById(game, id)
    if (tag) return this.getPlayerByTag(game, tag)
  },

  async getPlayerById(game, id) {
    if (!game || !id) return
    const memoed = memoizedPlayers.get(id + game)
    if (memoed) return memoed

    const gameRef = await getGameRef(game)
    if (!gameRef) return
    return gameRef
      .collection('players')
      .where('id', '==', id)
      .get()
      .then(async snapshot => {
        if (snapshot.docs.length === 0) {
          // low(`player ${id} of ${game} not found in database`)
          return
        }
        reads += snapshot.docs.length || 0
        if (snapshot.docs[0].redirect)
          return await this.getPlayerById(
            game,
            snapshot.docs[0].redirect
          )
        memoizedPlayers.set(id + game, snapshot.docs[0].data())
        return snapshot.docs[0].data()
      })
      .catch(err => {
        logError('Error getting player by id', err)
        return { error: err }
      })
  },

  async getPlayerByTag(game, tag) {
    if (!game || !tag) return
    const gameRef = await getGameRef(game)
    if (!gameRef) return
    return gameRef
      .collection('players')
      .where('tag', '==', tag)
      .where('redirect', '==', false)
      .get()
      .then(snapshot => {
        if (snapshot.docs.length === 0) {
          // low(`player ${tag} of ${game} not found in database`)
          return
        }
        reads += snapshot.docs.length || 0
        const disambig = prep.parsePlayerDisambiguation(
          snapshot.docs.map(d => d.data())
        )
        if (disambig && !Array.isArray(disambig))
          memoizedPlayers.set(
            disambig.id + game,
            snapshot.docs[0].data()
          )
        return disambig
      })
      .catch(err => {
        logError('Error getting player by tag', err)
        return { error: err }
      })
  },

  async getActivePlayers(game) {
    const gameRef = await getGameRef(game)
    if (!gameRef) return
    return gameRef
      .collection('players')
      .where('lastActive', '>', Date.now() / 1000 - aDayInSeconds * 7)
      .get()
      .then(snapshot => {
        reads += snapshot.docs.length || 0
        const playersData = snapshot.docs.map(d => d.data())
        playersData.forEach(p =>
          memoizedPlayers.set(p.id + p.game, p)
        )
        return playersData
        // .filter(p => !p.redirect)
      })
      .catch(err => {
        logError('Error getting players', err)
        return []
      })
  },

  async getSomeEvents(numberOfEvents = 3) {
    // get starting point from db
    if (
      getSomeEventsStartingPoint === undefined ||
      currentEventsCountedInRollingUpdate === undefined
    )
      await statsRef.get().then(async doc => {
        const data = doc.data()
        getSomeEventsStartingPoint = data.eventScanStart || 0
        currentEventsCountedInRollingUpdate =
          data.currentEventsCountedInRollingUpdate || 0
      })

    log(
      'getting some events starting from',
      getSomeEventsStartingPoint
    )

    return db
      .collectionGroup('events')
      .orderBy('ownerId')
      .limit(numberOfEvents)
      .startAfter(getSomeEventsStartingPoint)
      .get()
      .then(async snapshot => {
        if (!snapshot.docs.length) {
          // if there are no events, don't loop forever
          if (getSomeEventsStartingPoint === 0) return []
          // if it's the end, start over from 0
          getSomeEventsStartingPoint = 0
          await statsRef.get().then(async doc => {
            statsRef.update(
              {
                totalEventsEstimate:
                  doc.data().currentEventsCountedInRollingUpdate || 0,
                currentEventsCountedInRollingUpdate: 0,
              },
              { merge: true }
            )
            currentEventsCountedInRollingUpdate = 0
            reads++
            writes++
          })
          return await this.getSomeEvents()
        }
        getSomeEventsStartingPoint =
          snapshot.docs[snapshot.docs.length - 1].data().ownerId || 0 // start after last doc next time
        currentEventsCountedInRollingUpdate += snapshot.docs.length

        statsRef.update(
          {
            eventScanStart: getSomeEventsStartingPoint,
            currentEventsCountedInRollingUpdate: currentEventsCountedInRollingUpdate,
          },
          { merge: true }
        )

        writes++
        reads += snapshot.docs.length

        return snapshot.docs.map(d => d.data())
      })
      .catch(err => {
        logError('Error getting events', err)
        return []
      })
  },

  async getEvents(game) {
    const gameRef = await getGameRef(game)
    if (!gameRef) return
    return gameRef
      .collection('events')
      .get()
      .then(snapshot => {
        reads += snapshot.docs.length || 0
        return snapshot.docs.map(d => d.data())
      })
      .catch(err => {
        logError('Error getting events', err)
        return []
      })
  },

  async getEvent({ service, id, tournamentSlug, eventSlug, game }) {
    const memoed = memoizedEvents.get(
      service + (id || tournamentSlug + eventSlug) + game
    )
    if (memoed) return memoed

    const gameRef = await getGameRef(game)
    if (!gameRef) return
    let docRef = gameRef
      .collection('events')
      .where('service', '==', service)
    if (id) docRef = docRef.where('id', '==', id)
    else if (tournamentSlug && eventSlug)
      docRef = docRef
        .where('eventSlug', '==', eventSlug)
        .where('tournamentSlug', '==', tournamentSlug)

    return docRef
      .get()
      .then(snapshot => {
        if (snapshot.docs.length === 0) return
        const eventData = snapshot.docs[0].data()
        memoizedEvents.set(
          service + (id || tournamentSlug + eventSlug) + game,
          eventData
        )
        memoizedKnownEventStubs.set(
          service + (id || tournamentSlug + eventSlug) + game,
          true
        )
        reads += snapshot.docs.length || 0
        return eventData
      })
      .catch(err => {
        logError('Error getting event', err)
      })
  },

  async getEventExists({
    service,
    id,
    tournamentSlug,
    eventSlug,
    game,
  }) {
    const memoed = memoizedKnownEventStubs.get(
      service + (id || tournamentSlug + eventSlug) + game
    )
    if (memoed) return true
    return !!(await this.getEvent({
      service,
      id,
      tournamentSlug,
      eventSlug,
      game,
    }))
  },

  async addPlayer(player) {
    const playerData = prep.pruneUndefined(player)
    memoizedPlayers.set(player.id + player.game, playerData)
    const gameRef = await getGameRef(player.game)
    let playerRef = gameRef.collection('players').doc(`${player.id}`)
    await playerRef.set({
      ...playerData,
      lastUpdated: parseInt(Date.now() / 1000),
    })
    writes++
  },

  async updatePlayer(player) {
    const playerData = prep.pruneUndefined(player)
    memoizedPlayers.set(player.id + player.game, playerData)
    const gameRef = await getGameRef(player.game)
    let playerRef = gameRef.collection('players').doc(`${player.id}`)
    await playerRef.update(
      {
        ...playerData,
        lastUpdated: parseInt(Date.now() / 1000),
      },
      { merge: true }
    )
    writes++
  },

  async setPlayerActive(player) {
    player.lastActive = parseInt(Date.now() / 1000)
    this.updatePlayer(player)
  },

  async addEvent(event) {
    const eventData = prep.pruneUndefined(event)
    const gameRef = await getGameRef(event.game)
    let eventRef = gameRef
      .collection('events')
      .doc(event.service + event.id)
    await eventRef.set(eventData, { merge: true })
    writes++
    logAdd(
      'added event ' +
        `${event.name} @ ${event.tournamentName}` +
        ' on ' +
        event.service +
        ' to database'
    )
  },

  async deleteEvent(id, service, game) {
    memoizedEvents.delete(service + id + game)
    memoizedKnownEventStubs.delete(service + id + game)
    const gameRef = await getGameRef(game)
    let eventRef = gameRef.collection('events').doc(service + id)
    await eventRef.delete()
    deletes++
    logAdd('deleted event ' + id)
  },

  log(event) {
    if (typeof event !== 'string') return
    statsRef.update({
      [event]: admin.firestore.FieldValue.increment(1),
    })
    writes++
  },
  setStat(type, value) {
    if (typeof type !== 'string') return
    statsRef.update({
      [type]: value,
    })
    writes++
  },
}

const memoedGameRefs = {}
function getGameRef(game) {
  if (!game)
    return logError(
      `Attempted to get a reference to an undefined game.`,
      new Error().stack
    )
  if (memoedGameRefs[game]) return memoedGameRefs[game]
  return gamesRef
    .doc(game)
    .get()
    .then(async doc => {
      reads++
      if (memoedGameRefs[game]) return memoedGameRefs[game]
      memoedGameRefs[game] = doc.ref
      if (!doc.exists) {
        logAdd(`game ${game} not found in database, creating...`)
        await gamesRef.doc(game).create({})
        writes++
        // addCountListeners(doc.ref)
      }
      return doc.ref
    })
}

// async function addCountListeners(gameRef) {
//   gameRef.onSnapshot(querySnapshot => {
//     console.log(`Received query snapshot of size ${querySnapshot.size}`);
//     // ...
//   }
// }
