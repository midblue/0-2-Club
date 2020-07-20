<template>
  <div class="eventsearch">
    <button
      class="low marr"
      v-if="player.id && player.tag && !hasLoadedGetMore && !updatedTooRecently"
      @click="getMore"
    >
      Auto-Scan For More Events
    </button>
    <button
      :class="{ low: player.id }"
      v-if="!showSearchBar"
      @click="showSearchBar = true"
    >
      + Add Event by URL
    </button>
    <template v-else>
      <form @submit.prevent>
        <input
          v-model="searchUrl"
          autofocus
          placeholder="Enter a smash.gg URL..."
        />
        <button class="low" type="submit" @click="searchFor">Add</button>
      </form>
    </template>
  </div>
</template>

<script>
import axios from '~/plugins/axios'
export default {
  props: {
    player: {},
  },
  data() {
    return {
      showSearchBar: false,
      hasLoadedGetMore: false,
      searchUrl: '',
      // 'https://smash.gg/tournament/battle-gateway-21-1/events/melee-singles-vs/standings?page=2',
    }
  },
  computed: {
    updatedTooRecently() {
      return Date.now() - (this.player.lastUpdated || 0) * 1000 < 30 * 60 * 1000
    },
  },
  watch: {},
  mounted() {
    console.log(this.player)
  },
  methods: {
    searchFor() {
      let event
      if (this.searchUrl.indexOf('//smash.gg/') > -1)
        event = parseSmashGGEventURL(this.searchUrl)

      if (event) {
        if (event.err) {
          return this.$store.dispatch('notifications/notify', event.err)
        }
        this.$store.commit('setIsLoading', true)
        axios
          .get(
            event.eventSlug
              ? `/api/event/${event.service}/${this.player.game}/${event.tournamentSlug}/${event.eventSlug}/`
              : `/api/event/${event.service}/${this.player.game}/${event.tournamentSlug}/`,
          )
          .then(res => {
            this.$store.commit('setIsLoading', false)

            if (res.data && !res.data.err) {
              this.$store.dispatch('notifications/notify', `Done!`)
            } else
              this.$store.dispatch(
                'notifications/notify',
                `We didn't find any event at that URL! Check to make sure that it has /tournament/ in it, and that the event is for your game.`,
              )
          })
      } else
        this.$store.dispatch(
          'notifications/notify',
          `That URL isn't recognizable! Please enter a URL with a service we support.`,
        )
    },
    getMore() {
      if (this.hasLoadedGetMore) return
      this.$store.commit('setIsLoading', true)
      this.hasLoadedGetMore = true
      axios
        .get(`/api/more/${this.player.game}/${this.player.id}/`)
        .catch(console.log)
    },
  },
}

function parseSmashGGEventURL(url) {
  if (url.indexOf('tournament') > -1) {
    const match = /\/tournament\/([^/]*)\/?(?:events?\/([^/]*))?/g.exec(url)
    if (!match)
      return {
        err: `That URL isn't recognizable! Check to make sure that it has /tournament/ in it.`,
      }
    const [wholeString, ts, es] = match
    return {
      service: 'smashgg',
      tournamentSlug: ts,
      eventSlug: es,
    }
  }
  return {
    err: `That URL isn't recognizable! Check to make sure that it has /tournament/ in it.`,
  }
}
</script>

<style lang="scss" scoped>
.eventsearch {
  width: 100%;
  position: relative;
  display: inline-flex;

  @media (max-width: 768px) {
    display: block;

    & > * {
      margin-bottom: 5px;
    }
  }
}

button {
  flex-shrink: 0;
}
.marr {
  margin-right: 10px;
}

button,
form,
input {
  margin: 0;
  height: 100%;
}

form {
  width: 100%;
  display: inline-flex;
}

input {
  flex: 1;
  padding: 11px 10px;
  max-width: 600px;
}

div.sub {
  margin-left: 15px;
}
</style>
