<template>
  <section>
    <h1>
      We found multiple
      <span class="highlight">{{player.tag}}</span>s! Which are you?
    </h1>
    <nuxt-link
      v-for="p, index in disambiguation"
      :to="`/g/${player.game}/i/${p.id}`"
      class="button full"
      :key="p.id"
      @click="userIs(index)"
    >
      <h2>{{p.tag}}</h2>
      <div v-if="p.participatedInEvents">
        <div v-for="event in p.participatedInEvents" :key="event.id">
          Placed {{event.standing}}/{{event.totalParticipants}} in
          {{event.name}} at
          <b>{{event.tournamentName}}</b>
        </div>
      </div>
    </nuxt-link>
    <br />
    <br />
    <br />
    <div class="button" @click="combineAll">These are all the same person</div>
  </section>
</template>

<script>
import axios from '~/plugins/axios'

export default {
  asyncData({ params, error, redirect }) {
    return axios
      .get(`/api/points/${params.game}/tag/${encodeURIComponent(params.tag)}/`)
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
    return {}
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
      const idWithMostEvents = this.disambiguation.reduce(
        (mostEvents, player) => {
          if (player.participatedInEvents.length > mostEvents.total)
            return { id: player.id, total: player.participatedInEvents.length }
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
            this.$router.push(`/g/${this.player.game}/t/${this.player.tag}`)
          } else console.log(err)
        })
    },
  },
}
</script>

<style scoped lang="scss">
h2 {
  margin: 0;
}
.button.full {
  display: block;
}
</style>
