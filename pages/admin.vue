<template>
  <section>
    <h1>Admin</h1>
    <pre>{{ JSON.stringify(stats, null, 2) }}</pre>
    <button @click="scanForNewEvents">Scan for New Events</button>
    <button @click="rollingUpdate">Rolling Update</button>

    <div
      class="button"
      v-for="(event, index) in presetEvents"
      :key="'event' + index"
      @click="loadEvent(index)"
    >Load {{ event.eventSlug }} {{ event.tournamentSlug }}</div>

    <br />

    <div
      class="button"
      v-for="(player, index) in presetPlayers"
      :key="'p' + index"
      @click="moreForPlayer(player)"
    >More for {{ player.tag }}</div>

    <br />

    <div class="color" style="background: var(--l0l)"></div>
    <div class="color" style="background: var(--l1l)"></div>
    <div class="color" style="background: var(--l2l)"></div>
    <div class="color" style="background: var(--l3l)"></div>
    <div class="color" style="background: var(--l4l)"></div>
    <div class="color" style="background: var(--l5l)"></div>
    <div class="color" style="background: var(--l6l)"></div>
    <div class="color" style="background: var(--l7l)"></div>
    <div class="color" style="background: var(--l8l)"></div>
    <div class="color" style="background: var(--l9l)"></div>
    <div class="color" style="background: var(--l10l)"></div>
    <div class="color" style="background: var(--l11l)"></div>
    <div class="color" style="background: var(--l12l)"></div>
    <div class="color" style="background: var(--l13l)"></div>

    <br />

    <div class="color" style="background: var(--l0)"></div>
    <div class="color" style="background: var(--l1)"></div>
    <div class="color" style="background: var(--l2)"></div>
    <div class="color" style="background: var(--l3)"></div>
    <div class="color" style="background: var(--l4)"></div>
    <div class="color" style="background: var(--l5)"></div>
    <div class="color" style="background: var(--l6)"></div>
    <div class="color" style="background: var(--l7)"></div>
    <div class="color" style="background: var(--l8)"></div>
    <div class="color" style="background: var(--l9)"></div>
    <div class="color" style="background: var(--l10)"></div>
    <div class="color" style="background: var(--l11)"></div>
    <div class="color" style="background: var(--l12)"></div>
    <div class="color" style="background: var(--l13)"></div>

    <br />

    <div class="color" style="background: var(--l0d)"></div>
    <div class="color" style="background: var(--l1d)"></div>
    <div class="color" style="background: var(--l2d)"></div>
    <div class="color" style="background: var(--l3d)"></div>
    <div class="color" style="background: var(--l4d)"></div>
    <div class="color" style="background: var(--l5d)"></div>
    <div class="color" style="background: var(--l6d)"></div>
    <div class="color" style="background: var(--l7d)"></div>
    <div class="color" style="background: var(--l8d)"></div>
    <div class="color" style="background: var(--l9d)"></div>
    <div class="color" style="background: var(--l10d)"></div>
    <div class="color" style="background: var(--l11d)"></div>
    <div class="color" style="background: var(--l12d)"></div>
    <div class="color" style="background: var(--l13d)"></div>
  </section>
</template>

<script>
import axios from '~/plugins/axios'
const { parseIp } = require('~/common/functions').default

export default {
  scrollToTop: true,
  async asyncData({ req, error }) {
    if (req) {
      const ipInfo = parseIp(req)
      require('~/api/scripts/log')('page:admin', 'gray')(
        ipInfo.name || ipInfo.ip
      )
      if (!ipInfo.allowed)
        return error({ statusCode: 404, message: 'Not found.' })
    }
    let { data } = await axios.get(`/api/stats`)
    return { stats: data }
  },
  head() {
    title: 'Admin'
  },
  components: {},
  data() {
    return {
      presetPlayers: [
        {
          id: '517615',
          tag: 'H0P',
          game: 'Super Smash Bros. Melee',
        },
        {
          id: '33222',
          tag: 'DoodleDork',
          game: 'Super Smash Bros. Melee',
        },
        {
          id: '1583613',
          tag: 'Fluffy',
          game: 'Super Smash Bros. Ultimate',
        },
      ],
      presetEvents: [
        {
          service: 'smashgg',
          eventSlug: 'dx-melee-singles-1-vs-1',
          tournamentSlug: 'battlegateway-29-1',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          eventSlug: 'melee-singles-vs',
          tournamentSlug: 'battlegateway-26',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          eventSlug: 'melee-singles',
          tournamentSlug: 'that-s-not-safe-90',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          eventSlug: 'melee',
          tournamentSlug: '21-1',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          eventSlug: 'melee-singels',
          tournamentSlug: 'meleeverse',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          eventSlug: 'ultimate-singles',
          tournamentSlug: 'waveshine-24',
          game: 'Super Smash Bros. Melee',
        },
      ],
    }
  },
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },
  },
  mounted() {
    this.$store.commit('clearPlayer')
  },
  methods: {
    scanForNewEvents() {
      this.$store.commit('setIsLoading', true)
      axios.get(`/api/scan/`).then(res => {
        this.$store.commit('setIsLoading', false)
        this.$store.dispatch('notifications/notify', `Done!`)
      })
    },
    rollingUpdate() {
      this.$store.commit('setIsLoading', true)
      axios.get(`/api/rolling/`).then(res => {
        this.$store.commit('setIsLoading', false)
        this.$store.dispatch('notifications/notify', `Done!`)
      })
    },
    loadEvent(index) {
      const event = this.presetEvents[index]
      this.$store.commit('setIsLoading', true)
      axios
        .get(
          `/api/event/${event.service}/${event.game}/${event.tournamentSlug}/${event.eventSlug}/`
        )
        .then(res => {
          this.$store.commit('setIsLoading', false)

          if (res.data && !res.data.err) {
            this.$store.dispatch('notifications/notify', `Added that event!`)
          } else
            this.$store.dispatch(
              'notifications/notify',
              `We didn't find an event at that URL! Check to make sure that it has /tournament/ AND /event/ in it.`
            )
        })
    },
    moreForPlayer(player) {
      this.$store.commit('setIsLoading', true)
      axios.get(`/api/more/${player.game}/${player.id}/`).then(res => {
        this.$store.commit('setIsLoading', false)
        this.$store.dispatch('notifications/notify', `Done!`)
      })
    },
  },
}
</script>

<style scoped lang="scss">
.button {
  display: block;
}

.color {
  display: inline-block;
  width: 40px;
  height: 40px;
  margin: 20px 20px 0 0;
}
</style>
