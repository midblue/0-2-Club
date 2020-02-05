<template>
  <section>
    <h1>
      We found multiple
      <span class="highlight">{{ player.tag }}</span
      >s!
    </h1>
    <h2>Which are you?</h2>
    <nuxt-link
      v-for="(p, index) in disambiguation"
      :to="`/g/${player.game}/i/${p.id}`"
      class="button full"
      :key="p.id"
      @click="userIs(index)"
    >
      <h3>{{ p.tag }}</h3>
      <div v-if="p.participatedInEvents">
        <div v-for="event in p.participatedInEvents" :key="event.id">
          Placed {{ event.standing }}/{{ event.totalParticipants }} in
          {{ event.name }} at
          <b>{{ event.tournamentName }}</b>
        </div>
      </div>
    </nuxt-link>
    <br />
    <br />
    <br />
    <button class="low" @click="combineAll">
      These are all the same person
    </button>
  </section>
</template>

<script>
import axios from '~/plugins/axios'

export default {
  asyncData({ params, error, redirect }) {
    return axios
      .get(
        `/api/points/${params.game}/tag/${encodeURIComponent(
          params.tag
        )}/`
      )
      .then(res => {
        if (!res.data.disambiguation)
          return redirect(`/g/${params.game}/t/${params.tag}`)
        return {
          player: {
            game: params.game,
            tag: params.tag,
          },
          points: [],
          ...res.data,
        }
      })
  },
  components: {},
  head() {
    return {
      meta: [
        {
          property: 'og:title',
          hid: `og:title`,
          content: `Disambiguation: ${this.player.tag} | The 0-2 Club`,
        },
        {
          property: 'twitter:title',
          hid: `twitter:title`,
          content: `Disambiguation: ${this.player.tag} | The 0-2 Club`,
        },
        {
          hid: `og:url`,
          property: 'og:url',
          content: `https://www.0-2.club/${this.player.game}/t/${this.player.tag}/disambiguation/`,
        },
      ],
    }
  },
  data() {
    return {}
  },
  computed: {},
  watch: {},
  mounted() {},
  beforeDestroy() {},
  methods: {
    combineAll() {
      const really = confirm(
        'Wait, really? This will irreparably combine all of the players shown here into one single tag. Is that really what you want?'
      )
      if (!really) return
      const idWithMostEvents = this.disambiguation.reduce(
        (mostEvents, player) => {
          if (player.participatedInEvents.length > mostEvents.total)
            return {
              id: player.id,
              total: player.participatedInEvents.length,
            }
          return mostEvents
        },
        { total: 0 }
      ).id
      return axios
        .get(
          `/api/combine/${this.player.game}/${encodeURIComponent(
            this.player.tag
          )}/${idWithMostEvents}`
        )
        .then(res => {
          if (res.data && !res.data.err) {
            this.$router.push(
              `/g/${this.player.game}/t/${this.player.tag}`
            )
          } else console.log(err)
        })
    },
  },
}
</script>

<style scoped lang="scss">
h1 {
  margin-bottom: 0px;
}
h2 {
  margin-bottom: 30px;
}
h3 {
  font-size: 2em;
  margin: 0;
}
.button.full {
  display: block;
}
</style>
