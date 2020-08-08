<template>
  <section>
    <h2>
      We found multiple
      <span class="highlight">{{ player.tag }}</span
      >s!
    </h2>
    <h3>Which are you looking for?</h3>
    <nuxt-link
      v-for="(p, index) in disambiguation"
      :to="`/g/${player.game}/i/${p.id}`"
      class="button full"
      :key="p.id"
      @click="userIs(index)"
    >
      <h3>
        <div
          v-if="p.img"
          :style="{ 'background-image': `url('${p.img}')` }"
          class="playericon big"
        />
        {{ p.tag }}
      </h3>
      <div v-if="p.participatedInEvents">
        <div v-for="event in p.participatedInEvents" :key="event.id">
          {{ event.standing }} of {{ event.totalParticipants }} in
          {{ event.name }} at
          <b>{{ event.tournamentName }}</b>
        </div>
      </div>
    </nuxt-link>
    <br />
    <br />
    <br />
    Or, if none of them are you, add an event you've been in here!<br />
    Your URL should look something like
    <code
      v-html="
        `https://smash.gg/tournament/<b><i>[tournament name]</i></b>/events/`
      "
    ></code
    >.
    <EventSearch />
    <!-- <br />
    <br />
    <br />
    <button class="low" @click="combineAll">
      These are all the same person
    </button> -->
  </section>
</template>

<script>
import axios from '~/plugins/axios'
const { parseIp } = require('~/common/functions')
import EventSearch from '~/components/EventSearch'

// todo crashed here once? zain disambig is weird... 1563637
// todo like... combine _request_? idk

export default {
  asyncData({ params, error, redirect, req }) {
    if (req) {
      const ipInfo = parseIp(req)
      if (ipInfo.log)
        require('~/server/scripts/log')('page:disamb', 'gray')(
          ipInfo.name || ipInfo.ip,
          params.game,
          params.tag,
        )
      if (!ipInfo.allowed)
        return error({ statusCode: 404, message: 'Not found.' })
    }
    return axios
      .get(`/api/player/${params.game}/tag/${encodeURIComponent(params.tag)}/`)
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
  components: { EventSearch },
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
          content: `http://www.0-2.club/${encodeURIComponent(
            this.player.game,
          )}/t/${encodeURIComponent(this.player.tag)}/disambiguation/`,
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
        'Wait, really? This will irreversibly combine all of the players shown here into one single tag. Is that really what you want?',
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
        { total: 0 },
      ).id
      return axios
        .get(
          `/api/combine/${this.player.game}/${encodeURIComponent(
            this.player.tag,
          )}/${idWithMostEvents}`,
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
h1 {
  margin-bottom: 0px;
}
h2 {
  margin-bottom: 30px;
}
h3 {
  font-size: 2em;
  margin: 0;
  display: flex;
  align-items: center;
}
.button.full {
  display: block;
}
</style>
