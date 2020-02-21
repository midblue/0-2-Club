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

module.exports = {
  async getStats() {
    return statsRef.get().then(async doc => {
      const games = await this.getGames()
      return { ...doc.data(), games }
    })
  },

  async updateActive(game, count) {
    await statsRef.update(
      {
        [`active.${game.replace(/\./g, '')}`]: count,
      },
      { merge: true }
    )
  },

  async updateStats() {
    // todo update player and event counts from here
    // const totals = { events: {}, players: {} }
    // return gamesRef.get().then(async snapshot => {
    //   await Promise.all(
    //     snapshot.docs.map(async doc => {
    //       const game = doc.ref._path.segments[1]
    //       const data = doc.data() || { events: 0, players: 0 }
    //       totals.events[game] = data.events || 0
    //       totals.players[game] = data.players || 0
    //     })
    //   )
    //   await statsRef.update(
    //     {
    //       ...totals,
    //     },
    //     { merge: true }
    //   )
    // })
  },

  async getGames() {
    return gamesRef
      .get()
      .then(snapshot => {
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

  // async getPlayers(game) {
  //   const gameRef = await getGameRef(game)
  //   if (!gameRef) return
  //   return gameRef
  //     .collection('players')
  //     .get()
  //     .then(snapshot => {
  //       // todo memo
  //       return snapshot.docs.map(d => d.data())
  //       // .filter(p => !p.redirect)
  //     })
  //     .catch(err => {
  //       logError('Error getting players', err)
  //       return []
  //     })
  // },

  async getActivePlayers(game) {
    const gameRef = await getGameRef(game)
    if (!gameRef) return
    return gameRef
      .collection('players')
      .where('lastActive', '>', Date.now() / 1000 - aDayInSeconds * 7)
      .get()
      .then(snapshot => {
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

  async getSomeEvents() {
    // get starting point from db
    if (
      !getSomeEventsStartingPoint ||
      !currentEventsCountedInRollingUpdate
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
      .limit(10)
      .startAfter(getSomeEventsStartingPoint)
      .get()
      .then(async snapshot => {
        if (!snapshot.docs.length) {
          // if it's the end, start over from 0
          getSomeEventsStartingPoint = 0
          await statsRef.get().then(async doc => {
            statsRef.update(
              {
                totalEventsEstimate: doc.data()
                  .currentEventsCountedInRollingUpdate,
              },
              { merge: true }
            )
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
        return snapshot.docs.map(d => d.data())
      })
      .catch(err => {
        logError('Error getting events', err)
        return []
      })
  },

  async getEvent({ service, id, tournamentSlug, slug, game }) {
    const memoed = memoizedEvents.get(
      service + (id || tournamentSlug + slug) + game
    )
    if (memoed) return memoed

    const gameRef = await getGameRef(game)
    if (!gameRef) return
    let docRef = gameRef
      .collection('events')
      .where('service', '==', service)
    if (id) docRef = docRef.where('id', '==', id)
    else if (tournamentSlug && slug)
      docRef = docRef
        .where('slug', '==', slug)
        .where('tournamentSlug', '==', tournamentSlug)

    return docRef
      .get()
      .then(snapshot => {
        if (snapshot.docs.length === 0) return
        const eventData = snapshot.docs[0].data()
        memoizedEvents.set(
          service + (id || tournamentSlug + slug) + game,
          eventData
        )
        memoizedKnownEventStubs.set(
          service + (id || tournamentSlug + slug) + game,
          true
        )
        return eventData
      })
      .catch(err => {
        logError('Error getting event', err)
      })
  },

  async getEventExists({ service, id, tournamentSlug, slug, game }) {
    const memoed = memoizedKnownEventStubs.get(
      service + (id || tournamentSlug + slug) + game
    )
    if (memoed) return true
    return !!(await this.getEvent({
      service,
      id,
      tournamentSlug,
      slug,
      game,
    }))
  },

  async addPlayer(player, incrementCounter = true) {
    const playerData = prep.pruneUndefined(player)
    memoizedPlayers.set(player.id + player.game, playerData)
    const gameRef = await getGameRef(player.game)
    let playerRef = gameRef.collection('players').doc(`${player.id}`)
    await playerRef.set({
      ...playerData,
      lastUpdated: parseInt(Date.now() / 1000),
    })
    // if (incrementCounter)
    //   await gameRef.set(
    //     {
    //       players: increment,
    //     },
    //     { merge: true }
    //   )
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
    // await gameRef.set(
    //   {
    //     events: increment,
    //   },
    //   { merge: true }
    // )
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
    // await gameRef.set(
    //   {
    //     events: decrement,
    //   },
    //   { merge: true }
    // )
    logAdd('deleted event ' + id)
  },

  log(event) {
    if (typeof event !== 'string') return
    statsRef.update({
      [event]: admin.firestore.FieldValue.increment(1),
    })
  },
  setStat(type, value) {
    if (typeof type !== 'string') return
    statsRef.update({
      [type]: value,
    })
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
      if (memoedGameRefs[game]) return memoedGameRefs[game]
      memoedGameRefs[game] = doc.ref
      if (!doc.exists) {
        logAdd(`game ${game} not found in database, creating...`)
        await gamesRef.doc(game).create({})
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
