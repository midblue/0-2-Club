<template>
  <section>
    <h1>
      {{ player.tag }}
      <span class="sub">{{ player.game }}</span>
    </h1>

    <template v-if="!displayEvents">No events yet!</template>

    <template v-else>
      <h2>
        Level {{level.level}} — {{level.label}}
        <span class="sub">
          ({{ totalPoints }} points in {{ displayEvents.length }} event{{
          displayEvents.length === 1 ? '' : 's'
          }})
        </span>
        <span class="sub" v-if="checkForUpdates">— (loading more events...)</span>
      </h2>
    </template>

    <EventSearch
      :game="player.game"
      :playerId="player.id"
      @events="addedEvents"
      @loading="checkForUpdates = true"
    />

    <template v-if="displayEvents">
      <div>
        <div v-for="event in displayEvents" :key="event.slug + event.tournamentSlug">
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
            <span class="sub">
              {{
              new Date(point.date * 1000).toLocaleTimeString()
              }}
            </span>
            <span>+{{ point.value }}</span>
            <span>{{ point.title }}</span>
            <span class="sub">{{ point.context }}</span>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script>
import axios from '~/plugins/axios'
import EventSearch from '~/components/EventSearch'
import levels from '~/common/levels'

export default {
  asyncData({ params, error, redirect }) {
    return axios.get(`/api/points/${params.game}/id/${params.id}`).then(res => {
      if (res.data && !res.data.err && !res.data.disambiguation) return res.data
      else
        return {
          player: {
            game: params.game,
            tag: params.tag,
          },
          points: [],
        }
    })
  },
  components: { EventSearch },
  head() {
    return {}
  },
  data() {
    return {
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
  beforeDestroy() {
    clearInterval(this.checkForUpdatesInterval)
  },
  methods: {
    reCheckPoints() {
      return new Promise(async resolve => {
        await axios
          .get(`/api/points/${this.player.game}/id/${this.player.id}/`)
          .then(res => {
            if (res.data && !res.data.err) {
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
  grid-template-columns: 0.4fr 0.2fr 0.9fr 1fr;

  &.padtop {
    padding-top: 10px;
  }
}
</style>
