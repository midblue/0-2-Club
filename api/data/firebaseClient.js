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

const memoizedEvents = memo(500)

module.exports = {
  async getStats() {
    // todo player and event counts
    return statsRef.get().then(async doc => {
      const games = await this.getGames()
      return { ...doc.data(), games }
    })
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
        return snapshot.docs[0].data()
      })
      .catch(err => {
        logError('Error getting player by id', err)
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
        return prep.parsePlayerDisambiguation(
          snapshot.docs.map(d => d.data())
        )
      })
      .catch(err => {
        logError('Error getting player by tag', err)
      })
  },

  async getPlayers(game) {
    const gameRef = await getGameRef(game)
    if (!gameRef) return
    return gameRef
      .collection('players')
      .get()
      .then(snapshot => {
        return snapshot.docs
          .map(d => d.data())
          .filter(p => !p.redirect)
      })
      .catch(err => {
        logError('Error getting players', err)
        return []
      })
  },

  async getEvents(game) {
    const gameRef = await getGameRef(game)
    if (!gameRef) return
    // todo could use memoed games here to reduce calls slightly
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
        memoizedEvents.set(
          service + (id || tournamentSlug + slug) + game,
          snapshot.docs[0].data()
        )
        return snapshot.docs[0].data()
      })
      .catch(err => {
        logError('Error getting event', err)
      })
  },

  async addPlayer(player) {
    const gameRef = await getGameRef(player.game)
    let playerRef = gameRef.collection('players').doc(`${player.id}`)
    await playerRef.set({
      ...player,
      lastUpdated: parseInt(Date.now() / 1000),
    })
  },

  async updatePlayer(player) {
    const gameRef = await getGameRef(player.game)
    let playerRef = gameRef.collection('players').doc(`${player.id}`)
    await playerRef.update(
      {
        ...player,
        lastUpdated: parseInt(Date.now() / 1000),
      },
      { merge: true }
    )
  },

  async setPlayerActive(player) {
    player.lastActive = parseInt(Date.now() / 1000)
    this.addPlayer(player)
  },

  async addEvent(event) {
    const gameRef = await getGameRef(event.game)
    let eventRef = gameRef
      .collection('events')
      .doc(event.service + event.id)
    await eventRef.set(event, { merge: true })
    logAdd(
      'added event ' +
        `${event.name} @ ${event.tournamentName}` +
        ' on ' +
        event.service +
        ' to database'
    )
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
        low(`game ${game} not found in database, creating...`)
        await gamesRef.doc(game).create({})
      }
      return doc.ref
    })
}
