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
        <h2>
          <span
            class="colorpad multiply"
            :style="{ background: `var(--l${level.level})` }"
            >Level {{ level.level }} — {{ level.label }}</span
          >
        </h2>
        <span>
          {{
            `
            ${totalPoints} points in 
            ${displayEvents.length} event${
              displayEvents.length === 1 ? '' : 's'
            },
            ${pointsToNextLevel} points until level ${level.level + 1}
          `
          }}
        </span>
        <span class="sub" v-if="checkForUpdates">— loading more events...</span>
        <div v-if="peers && peers.length > 0">
          <b>Related Players:</b>
          <span v-for="peer in peers">
            <nuxt-link :to="`/g/${player.game}/i/${peer.id}`">{{
              peer.tag
            }}</nuxt-link>
            &nbsp;
          </span>
        </div>
      </div>
    </template>

    <ProgressChart
      v-if="displayEvents"
      :points="points"
      :player="player"
      :level="level.level"
      :peers="peers"
    />

    <h1 v-if="displayEvents">Events</h1>

    <EventSearch
      :game="player.game"
      :playerId="player.id"
      @events="addedEvents"
      @loading="checkForUpdates = true"
    />

    <template v-if="displayEvents">
      <div>
        <div
          class="panel"
          v-for="event in displayEvents"
          :key="event.slug + event.tournamentSlug"
        >
          <h3>
            <span
              class="colorpad"
              :style="{ background: `var(--l${level.level})` }"
              >+{{ event.points.reduce((t, p) => t + p.value, 0) }}</span
            >
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
              >+{{ point.value }}</span
            >
            <span class="title">{{ point.title }}</span>
            <span class="context sub"
              ><span
                >{{ point.context }}
                <nuxt-link
                  v-if="point.opponent"
                  :to="`/g/${player.game}/i/${point.opponent.id}`"
                  >{{ point.opponent.tag }}</nuxt-link
                ></span
              >
            </span>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script>
import EventSearch from '~/components/EventSearch'
import ProgressChart from '~/components/ProgressChart'
import levels from '~/common/levels'
import axios from 'axios'

export default {
  props: {
    initialPlayer: {},
    initialPeers: {},
    initialPoints: {},
  },
  components: { EventSearch, ProgressChart },
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
      l--
      return { ...this.levels[l], level: l }
    },
    pointsToNextLevel() {
      return this.levels[(this.level.level || 0) + 1].points - this.totalPoints
    },
  },
  watch: {
    checkForUpdates(willCheck, wasChecking) {
      // todo def have an loading indcator
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
  mounted() {
    if (window) window.scrollTo(0, 0)
  },
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
      margin-bottom: 30px;
    }
    margin-bottom: 0px;
  }
}
.level {
  margin-bottom: 4em;

  h2 {
    margin-top: 0;
    margin-bottom: 8px;
  }
}

.panel {
  h3 {
    margin-top: 0;
  }
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

.compare.active {
  background: gray;
  color: white;
}
</style>
