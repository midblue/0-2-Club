<template>
  <div class="eventsearch">
    <button
      class="low marr"
      v-if="playerId && !hasLoadedGetMore"
      @click="getMore"
    >Auto-Scan For Recent Events</button>
    <button class="low" v-if="!showSearchBar" @click="showSearchBar = true">+ Add Event by URL</button>
    <template v-else>
      <form @submit.prevent>
        <input v-model="searchUrl" autofocus placeholder="Enter a URL..." />
        <button class="low" type="submit" @click="searchFor">Add</button>
      </form>
      <div class="sub" v-if="!playerId">
        If you give us one tournament you've been in, we should be able to find
        more automatically!
      </div>
    </template>
  </div>
</template>

<script>
import axios from '~/plugins/axios'

export default {
  props: {
    playerId: {},
    game: {},
  },
  data() {
    return {
      showSearchBar: false,
      hasLoadedGetMore: false,
      searchUrl:
        'https://smash.gg/tournament/battle-gateway-21-1/events/melee-singles-vs/standings?page=2',
    }
  },
  watch: {},
  mounted() {},
  methods: {
    searchFor() {
      let event
      if (this.searchUrl.indexOf('//smash.gg/') > -1)
        event = parseSmashGGEvent(this.searchUrl)

      if (event) {
        if (event.err) {
          return this.$store.dispatch('notifications/notify', event.err)
        }
        this.$store.commit('setIsLoading', true)
        axios
          .get(
            `/api/event/${event.service}/${this.game}/${event.tournamentSlug}/${event.eventSlug}/`
          )
          .then(res => {
            this.$store.commit('setIsLoading', false)
            if (res.data && !res.data.err) this.$emit('events', [res.data])
            else
              this.$store.dispatch(
                'notifications/notify',
                `We didn't find an event at that URL! Check to make sure that it has /tournament/ AND /event/ in it.`
              )
          })
      } else
        this.$store.dispatch(
          'notifications/notify',
          `That URL isn't recognizable! Please enter a URL with a service we support.`
        )
    },
    getMore() {
      this.$emit('loading')
      this.$store.commit('setIsLoading', true)
      this.hasLoadedGetMore = true
      axios.get(`/api/more/${this.game}/${this.playerId}/`).then(res => {
        if (res.data && !res.data.err) {
          this.$store.commit('setIsLoading', false)
          this.$emit('events', [res.data])
        }
      })
    },
  },
}

function parseSmashGGEvent(url) {
  if (url.indexOf('tournament') > -1 && url.indexOf('event') > -1) {
    const [
      wholeString,
      ts,
      es,
    ] = /\/tournament\/([^/]*)\/events?\/([^/]*)/g.exec(url)
    return {
      service: 'smashgg',
      tournamentSlug: ts,
      eventSlug: es,
    }
  }
  return {
    err: `That URL isn't recognizable! Check to make sure that it has /tournament/ AND /event/ in it.`,
  }
}
</script>

<style lang="scss" scoped>
.eventsearch {
  width: 100%;
  position: relative;
  display: inline-flex;
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
}
</style>
