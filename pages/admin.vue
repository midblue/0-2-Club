<template>
  <section>
    <h1>Admin</h1>
    <pre>{{ JSON.stringify(stats, null, 2) }}</pre>
    <button @click="daily">Daily</button>

    <div
      class="button"
      v-for="(event, index) in presetEvents"
      :key="'event' + index"
      @click="loadEvent(index)"
    >
      Load {{ event.slug }} {{ event.tournamentSlug }}
    </div>

    <br />

    <div
      class="button"
      v-for="(player, index) in presetPlayers"
      :key="'p' + index"
      @click="moreForPlayer(player)"
    >
      More for {{ player.tag }}
    </div>
  </section>
</template>

<script>
import axios from '~/plugins/axios'

export default {
  scrollToTop: true,
  async asyncData() {
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
          slug: 'dx-melee-singles-1-vs-1',
          tournamentSlug: 'battlegateway-29-1',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          slug: 'melee-singles-vs',
          tournamentSlug: 'battlegateway-26',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          slug: 'melee-singles',
          tournamentSlug: 'that-s-not-safe-90',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          slug: 'melee',
          tournamentSlug: '21-1',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          slug: 'melee-singels',
          tournamentSlug: 'meleeverse',
          game: 'Super Smash Bros. Melee',
        },
        {
          service: 'smashgg',
          slug: 'ultimate-singles',
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
  mounted() {},
  methods: {
    daily() {
      if (!confirm('Start daily?')) return
      this.$store.commit('setIsLoading', true)
      axios.get(`/api/daily/`).then(res => {
        this.$store.commit('setIsLoading', false)
        this.$store.dispatch('notifications/notify', `Up to date!`)
      })
    },
    loadEvent(index) {
      const event = this.presetEvents[index]
      this.$store.commit('setIsLoading', true)
      axios
        .get(
          `/api/event/${event.service}/${event.game}/${event.tournamentSlug}/${event.slug}/`
        )
        .then(res => {
          this.$store.commit('setIsLoading', false)

          if (res.data && !res.data.err) {
            this.$store.dispatch(
              'notifications/notify',
              `Added that event!`
            )
          } else
            this.$store.dispatch(
              'notifications/notify',
              `We didn't find an event at that URL! Check to make sure that it has /tournament/ AND /event/ in it.`
            )
        })
    },
    moreForPlayer(player) {
      this.$store.commit('setIsLoading', true)
      axios
        .get(`/api/more/${player.game}/${player.id}/`)
        .then(res => {
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
</style>
