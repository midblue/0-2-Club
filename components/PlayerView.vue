<template>
  <section>
    <div class="tag">
      <h1 class="inline">
        <div class="sub">{{ player.game }}</div>
        {{ player.tag || 'Id #' + player.id }}
      </h1>
    </div>

    <template v-if="!displayEvents">No events yet!</template>

    <template v-else>
      <div class="level">
        <h3>
          <span
            class="colorpad multiply"
            :style="{ background: `var(--l${level.level})` }"
          >Level {{ level.level }} — {{ level.label }}</span>
        </h3>

        <XPBar :totalPoints="totalPoints" :events="displayEvents" />
      </div>

      <Badges :points="points" class="badges" />
    </template>

    <ProgressChart
      v-if="displayEvents"
      :points="points"
      :player="player"
      :level="level.level"
      :peers="peers"
      class="chart"
    />

    <hr />

    <div class="eventslabel">
      <h2
        v-if="displayEvents"
      >{{displayEvents.length}} Event{{displayEvents.length === 1 ? '' : 's' }}</h2>

      <EventSearch
        :game="player.game"
        :playerId="player.id"
        @events="addedEvents"
        @loading="checkForUpdates = true"
        class="eventsearch"
      />
    </div>

    <template v-if="displayEvents">
      <div>
        <div class="panel" v-for="event in displayEvents" :key="event.slug + event.tournamentSlug">
          <h3>
            <span class="colorpad" :style="{ background: `var(--l${level.level})` }">
              +{{
              event.points.reduce((t, p) => t + p.value, 0)
              }}
            </span>
            {{ event.tournamentName }}
            <span class="sub">
              {{ event.name }} ({{
              new Date(event.date * 1000).toLocaleDateString()
              }})
            </span>
          </h3>
          <div
            v-for="(point, index) in event.points"
            :key="event.slug + event.tournamentSlug + 'point' + index"
            class="point"
            :class="{ padtop: point.title.indexOf('Set') > -1 }"
          >
            <span
              class="pointvalue"
              :style="{ color: `var(--l${level.level}d)` }"
            >+{{ point.value }}</span>
            <span class="title">{{ point.title }}</span>
            <span class="context sub">
              <span>
                {{ point.context }}
                <nuxt-link
                  v-if="point.opponent"
                  :to="`/g/${player.game}/i/${point.opponent.id}`"
                >{{ point.opponent.tag }}</nuxt-link>
              </span>
            </span>
          </div>
        </div>
      </div>
    </template>

    <hr />

    <div v-if="peers && peers.length > 0" class="peers flex">
      <div style="margin-right: 30px;">
        <b>Related Players</b>
      </div>
      <div>
        <span v-for="peer in peers">
          <nuxt-link :to="`/g/${player.game}/i/${peer.id}`">{{ peer.tag }}</nuxt-link>&nbsp;
        </span>
      </div>
    </div>
  </section>
</template>

<script>
import EventSearch from '~/components/EventSearch'
import ProgressChart from '~/components/ProgressChart'
import XPBar from '~/components/XPBar'
import Badges from '~/components/Badges'
import levels from '~/common/levels'
import axios from 'axios'

// todo badges

export default {
  props: {
    initialPlayer: {},
    initialPeers: {},
    initialPoints: {},
  },
  components: { EventSearch, ProgressChart, XPBar, Badges },
  data() {
    return {
      player: {},
      peers: [],
      points: [],
      levels,
      checkForUpdates: false,
      checkForUpdatesInterval: null,
    }
  },
  computed: {
    displayEvents() {
      return this.player.participatedInEvents
        ? this.player.participatedInEvents.slice().reverse()
        : null
    },
    totalPoints() {
      return this.points
        ? this.points.reduce((total, { value }) => total + value, 0)
        : 0
    },
    level() {
      let l = 0
      while (this.totalPoints > this.levels[l].points) l++
      if (l > 0) l--
      return { ...this.levels[l], level: l }
    },
  },
  watch: {
    checkForUpdates(willCheck, wasChecking) {
      if (willCheck !== wasChecking && willCheck) {
        this.checkForUpdatesInterval = setInterval(this.reCheckPoints, 1500)
      } else {
        clearInterval(this.checkForUpdatesInterval)
      }
    },
  },
  created() {
    this.player = this.initialPlayer
    this.points = this.initialPoints
    this.peers = this.initialPeers
  },
  mounted() {},
  beforeDestroy() {
    clearInterval(this.checkForUpdatesInterval)
  },
  methods: {
    reCheckPoints() {
      return new Promise(async resolve => {
        const url = this.player.id
          ? `/api/points/${this.player.game}/id/${this.player.id}/`
          : `/api/points/${this.player.game}/tag/${this.player.tag}/`
        await axios.get(url).then(res => {
          if (res.data && !res.data.err) {
            if (res.data.disambiguation) {
              return this.$router.replace(
                `/g/${this.player.game}/t/${this.player.tag}/disambiguation`
              )
            }
            for (let prop in res.data.player) {
              this.$set(this.player, prop, res.data.player[prop])
            }
            this.points = null
            if (res.data.peers) this.peers = res.data.peers
            this.$nextTick(() => (this.points = res.data.points))
          }
        })
      })
    },
    addedEvents(newEvents) {
      this.checkForUpdates = false
      this.reCheckPoints()
    },
  },
}
</script>

<style scoped lang="scss">
.tag {
  h1 {
    .sub {
      font-size: 0.85rem;
      margin-bottom: 10px;
    }
    margin-bottom: 0px;
  }
}
.level {
  margin-top: 3em;
  margin-bottom: 0.3em;

  h3 {
    margin-top: 0;
    margin-bottom: -5px;
  }
}
.badges {
  margin-bottom: 3em;
}

.chart {
  margin-bottom: 30px;
}
.peers {
  margin-bottom: 30px;
}

.panel {
  h3 {
    margin-top: 0;
  }
}

.eventslabel {
  margin: 30px 0 0 0;
  display: flex;
  align-items: center;

  & > * {
    margin-top: 0;
    margin-bottom: 0;
  }
}
.eventsearch {
  flex: 1;
  margin-left: 2em;
}

h3 {
  line-height: 1.1;
}

.point {
  line-height: 1.05;
  max-width: 500px;
  display: grid;
  grid-template-columns: 20px 0.9fr 1fr;
  grid-gap: 10px;

  &.padtop {
    padding-top: 10px;
  }

  .pointvalue {
    font-weight: bold;
  }

  // & > * {
  //   padding: 3px 5px;
  // }
}
</style>
