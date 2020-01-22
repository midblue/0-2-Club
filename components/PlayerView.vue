<template>
  <section>
    <nuxt-link to="/">Home</nuxt-link>
    <h1>
      {{ player.tag }}
      <span class="sub">{{ player.game }}</span>
    </h1>

    <template v-if="!displayEvents">No events yet!</template>

    <template v-else>
      <h2>
        <span :style="{ background: `var(--l${level.level})` }"
          >Level {{ level.level }} — {{ level.label }}</span
        >
        <span class="sub">
          ({{ totalPoints }} points in {{ displayEvents.length }} event{{
            displayEvents.length === 1 ? '' : 's'
          }})
        </span>
        <span class="sub" v-if="checkForUpdates"
          >— (loading more events...)</span
        >
      </h2>
    </template>

    <ProgressChart
      v-if="displayEvents"
      :points="points"
      :player="player"
      :level="level.level"
      :rivalId="rivalId"
      :rivalSearchTag="rivalSearchTag"
    />
    <div v-if="peers">
      <b>Compare:</b>
      <span v-for="peer in peers">
        <span
          class="compare"
          :class="{ active: rivalId === peer.id }"
          @click="
            rivalSearchTag = null
            rivalId = peer.id
          "
          >{{ peer.tag }}</span
        >
        &nbsp;
      </span>
      <span v-if="rivalId" @click="rivalId = null">Clear</span>
      <input
        v-model="inputRivalSearchTag"
        placeholder="Search for a user..."
      /><button @click="rivalSearchTag = inputRivalSearchTag">Compare</button>
    </div>

    <div v-if="peers">
      <b>Peers:</b>
      <span v-for="peer in peers">
        <nuxt-link :to="`/g/${player.game}/i/${peer.id}`">{{
          peer.tag
        }}</nuxt-link>
        &nbsp;
      </span>
    </div>

    <h1>Events</h1>

    <EventSearch
      :game="player.game"
      :playerId="player.id"
      @events="addedEvents"
      @loading="checkForUpdates = true"
    />

    <template v-if="displayEvents">
      <div>
        <div
          v-for="event in displayEvents"
          :key="event.slug + event.tournamentSlug"
        >
          <h3>
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
              :style="{ background: `var(--l${level.level})` }"
              >+{{ point.value }}</span
            >
            <span class="title">{{ point.title }}</span>
            <span class="context sub">{{ point.context }}</span>
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
      rivalId: null,
      inputRivalSearchTag: null,
      rivalSearchTag: null,
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
.point {
  line-height: 1.05;
  max-width: 500px;
  display: grid;
  grid-template-columns: 0.15fr 0.9fr 1fr;
  grid-gap: 20px;

  &.padtop {
    padding-top: 10px;
  }

  & > * {
    padding: 3px 5px;
  }
}

.compare.active {
  background: gray;
  color: white;
}
</style>
