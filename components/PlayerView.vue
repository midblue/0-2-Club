<template>
  <section>
    <div class="tag">
      <h1 class="inline">
        <div class="sub">{{ player.game }}</div>
        <div
          v-if="player.img"
          :style="{ 'background-image': `url('${player.img}')` }"
          class="playericon big"
        />
        <span class="text">{{
          player.tag || initialPlayer.tag || 'Id #' + player.id
        }}</span>
      </h1>
    </div>

    <template v-if="!displayEvents">
      <div class="emptystate">
        <h3>No events yet!</h3>
        <div>
          Enter a URL for a tournament you've been to below!
          <br />It should look something like
          <code
            v-html="
              `https://smash.gg/tournament/<b><i>[tournament name]</i></b>/events/`
            "
          ></code
          >.
        </div>
      </div>
    </template>

    <template v-if="displayEvents">
      <div class="level">
        <h3>
          <span>
            <span
              class="colorpad multiply"
              :style="{ background: `var(--l${level.level})` }"
              >Level {{ level.level }} — {{ level.label }}</span
            >
            <InfoTooltip
              >Get points by competing in tournaments to level up!</InfoTooltip
            >
          </span>

          <!-- <Share v-if="!isMobile" /> -->
        </h3>

        <XPBar :totalPoints="totalPoints" :events="displayEvents" />
      </div>

      <!-- <Share class="mobileshare" v-if="isMobile" /> -->
    </template>

    <Awards v-if="player.awards" :awards="player.awards" class="awardspane" />

    <div class="chartholder">
      <client-only>
        <ChartZone v-if="displayEvents" />
      </client-only>
    </div>

    <div class="colorzone2">
      <div class="bgholder">
        <div
          v-if="displayEvents"
          class="colorbg"
          :style="{
            background: `linear-gradient(125deg, var(--l${level.level}l), var(--l${level.level}))`,
          }"
        ></div>
      </div>
    </div>

    <div class="colorzone">
      <div class="bgholder">
        <div
          v-if="displayEvents"
          class="colorbg"
          :style="{
            background: `linear-gradient(to bottom, var(--text), var(--textl)), linear-gradient(125deg, var(--l${level.level}), var(--l${level.level}d))`,
          }"
        ></div>
      </div>

      <div class="eventslabel">
        <h2 v-if="displayEvents">
          Events
          <span class="sub">({{ displayEvents.length }})</span>
        </h2>

        <EventSearch :player="player" class="eventsearch" />
      </div>
      <EventsListing
        :events="displayEvents"
        :level="level.level"
        :game="player.game"
      />

      <template v-if="player.peers && player.peers.length > 0">
        <hr />

        <div class="peers bottom" :class="{ flex: !isMobile }">
          <div style="margin-right: 30px; flex-shrink: 0;">
            <b>Related Players</b>
          </div>
          <div>
            <span v-for="peer in player.peers" :key="peer.id">
              <nuxt-link v-if="peer" :to="`/g/${player.game}/i/${peer.id}`">
                <div
                  v-if="peer.img"
                  :style="{
                    'background-image': `url('${peer.img}')`,
                  }"
                  class="playericon"
                ></div>
              </nuxt-link>
              <nuxt-link
                :to="`/g/${player.game}/i/${peer.id}`"
                v-html="peer.tag"
              ></nuxt-link
              >&nbsp;&nbsp;
            </span>
          </div>
        </div>
      </template>
    </div>
  </section>
</template>

<script>
import InfoTooltip from '~/components/InfoTooltip'
import EventSearch from '~/components/EventSearch'
import EventsListing from '~/components/EventsListing'
import ChartZone from '~/components/Chart/ChartZone'
import XPBar from '~/components/XPBar'
import Stats from '~/components/Stats'
import Share from '~/components/Share'
import Awards from '~/components/Awards/Awards'
import levels from '~/common/levels'
import axios from 'axios'
const calculateAwards = require('~/common/awards')

import io from '~/node_modules/socket.io-client/dist/socket.io.js'

export default {
  props: {
    initialPlayer: {},
  },
  components: {
    InfoTooltip,
    EventSearch,
    EventsListing,
    ChartZone,
    XPBar,
    Stats,
    Share,
    Awards,
  },
  data() {
    return {
      levels,
      socket: null,
    }
  },
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },
    player() {
      return this.$store.state.player
    },
    displayEvents() {
      return this.player.participatedInEvents
        ? this.player.participatedInEvents.slice().reverse()
        : null
    },
    points() {
      return (this.player.participatedInEvents || []).reduce(
        (acc, event) => [
          ...acc,
          ...(event.points || []).map(p => ({
            ...p,
            eventName: event.name,
            tournamentName: event.tournamentName,
            eventSlug: event.eventSlug,
            tournamentSlug: event.tournamentSlug,
          })),
        ],
        [],
      )
    },
    totalPoints() {
      return (
        (this.points
          ? this.points.reduce((total, { value }) => total + value, 0)
          : 0) +
        (this.player.awards || []).reduce(
          (total, { points }) => total + points,
          0,
        )
      )
    },
    level() {
      let l = 0
      while (this.totalPoints > this.levels[l].points) l++
      if (l > 0) l--
      this.$store.commit('setPlayer', {
        level: { ...this.levels[l], level: l + 1 },
      })
      return { ...this.levels[l], level: l + 1 }
    },
  },
  watch: {},
  created() {
    this.$store.commit('setPlayer', {
      ...this.initialPlayer,
    })
    this.recalculateAwards()
    this.socketSetup()
  },
  mounted() {
    this.socketSetup()
  },
  beforeDestroy() {
    this.socket.emit(
      'leave',
      `${this.initialPlayer.game}/${this.initialPlayer.id}`,
    )
    this.socket.emit('leave', `${this.initialPlayer.game}`)
    this.$store.commit('clearPlayer')
    this.$store.commit('setIsLoading', false)
  },
  methods: {
    socketSetup() {
      if (
        !process.client ||
        this.socket ||
        !this.initialPlayer.game ||
        (!this.initialPlayer.id && !this.initialPlayer.tag)
      )
        return
      this.socket = io.connect('/')
      this.socket.emit(
        'join',
        `${this.initialPlayer.game}/${this.initialPlayer.id ||
          this.initialPlayer.tag}`,
      )
      this.socket.emit('join', `${this.initialPlayer.game}`)

      this.socket.on('startEventSearch', data => {
        this.$store.commit('setIsLoading', true)
        // todo 定期的に c00l melee facts...?
      })
      this.socket.on('newEvents', this.gotNewEvents)
      this.socket.on('notification', n => {
        this.$store.commit('setIsLoading', true)
      })
      this.socket.on('playerFullyUpdated', async data => {
        await this.refreshPlayer()
        // todo not firing sometimes for first-timers
      })
      this.socket.on('endEventSearch', async data => {
        await this.refreshPlayer()
        this.$store.commit('setIsLoading', false)
        this.$store.dispatch('notifications/notify', `Up to date!`)
      })
    },
    gotNewEvents(newEvents) {
      const newEventsWithPlayer = newEvents.filter(
        newEvent =>
          !(this.player.participatedInEvents || []).find(
            e => e.id === newEvent.id,
          ) &&
          (!this.player.id ||
            newEvent.participants.find(
              participant => participant.id === this.player.id,
            )),
      )
      if (!newEventsWithPlayer.length) return
      if (newEventsWithPlayer.length > 1)
        this.$store.dispatch(
          'notifications/notify',
          `Added ${newEventsWithPlayer.length} more event${
            newEventsWithPlayer.length === 1 ? '' : 's'
          } to ${this.player.tag}'s history!`,
        )
      else
        this.$store.dispatch(
          'notifications/notify',
          `Added ${newEventsWithPlayer[0].name} @ ${newEventsWithPlayer[0].tournamentName} to ${this.player.tag}'s history!`,
        )
      this.refreshPlayer()
    },
    refreshPlayer() {
      return axios
        .get(
          this.player.id
            ? `/api/player/${this.player.game}/id/${this.player.id}`
            : `/api/player/${this.player.game}/tag/${this.player.tag}`,
        )
        .then(res => {
          if (res.data && res.data.disambiguation) return this.$router.go()
          this.$store.commit('setPlayer', {
            ...res.data,
            awards: calculateAwards(res.data),
          })
        })
    },
    recalculateAwards() {
      this.$store.commit('setPlayer', {
        ...this.player,
        awards: calculateAwards(this.player),
      })
    },
  },
}
</script>

<style scoped lang="scss">
.tag {
  margin-top: 1em;

  h1 {
    margin-bottom: 0px;

    .sub {
      font-size: 0.85rem;
      margin-bottom: 10px;
    }

    .text {
      position: relative;
      top: -5px;
    }
  }

  @media (max-width: 768px) {
    margin-top: 0em;
  }
}
.level {
  margin-top: 0.5em;
  margin-bottom: 2em;

  h3 {
    margin-top: 0;
    margin-bottom: 0px;
    display: flex;
    justify-content: space-between;
  }
}

.mobileshare {
  position: relative;
  top: -18px;
}

.stats {
  margin-bottom: 2em;
}
.awardspane {
  margin-bottom: 3em;
}

.chartholder {
  position: relative;
  display: flex;
  z-index: 3;
  padding: 0;
  margin-bottom: 2em;
  background: white;
  border-radius: var(--radius);
}
.chart {
  padding: 0;
  margin: 0;
}

.panel {
  h3 {
    margin-top: 0;
  }
}

.colorzone,
.colorzone > *,
.colorzone2,
.colorzone2 > * {
  position: relative;
  z-index: 2;
}

.bgholder {
  box-sizing: content-box;
  overflow: hidden;
  position: absolute;
  z-index: 1;
  left: -100vw;
  right: -100vw;
  height: 100%;
  padding-bottom: 300px;
}
.colorbg {
  position: absolute;
  top: 230px;
  left: -100vw;
  right: -100vw;
  bottom: -50vh;
  transform-origin: top center;
  transform: rotate(-4deg);
  background-blend-mode: multiply;
  filter: grayscale(40%) brightness(0.7);
}

.colorzone2 {
  z-index: 0;

  .bgholder {
    top: -380px;
    padding-bottom: 900px;
    z-index: 0;
  }
  .colorbg {
    top: 250px;
    opacity: 0.3;
    filter: none;
    transform: rotate(5deg);
    filter: grayscale(40%);
  }
}

.eventslabel {
  margin: 4em 0 0 0;
  display: flex;
  // align-items: center;

  @media (max-width: 768px) {
    display: block;
  }

  & > * {
    margin-top: 0;
    margin-bottom: 0;
  }

  h2 {
    margin-right: 30px;
  }
}
.eventsearch {
  flex: 1;
}

h3 {
  line-height: 1.1;
}

hr {
  border-top: 1px dashed white;
  opacity: 0.5;
}

.bottom,
.bottom a {
  color: white !important;
}
</style>
