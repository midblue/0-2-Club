<template>
  <div class="eventsearch">
    <h3>Add an Event Manually</h3>
    <form @submit.prevent>
      <input
        autofocus
        v-model="searchUrl"
        placeholder="Enter a Smash.gg URL..."
      />
      <button class="low" type="submit" @click="searchFor">Add</button>
    </form>
    <div v-if="notifyMessage">{{ notifyMessage }}</div>
    <div class="sub" v-if="!playerId">
      If you give us one tournament you've been in, we should be able to find
      more automatically!
    </div>
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
      searchUrl:
        'https://smash.gg/tournament/battle-gateway-21-1/events/melee-singles-vs/standings?page=2',
      notifyMessage: null,
    }
  },
  watch: {
    playerId(newId, oldId) {
      if (newId !== oldId) this.getMore()
    },
  },
  mounted() {
    if (this.playerId) this.getMore()
  },
  methods: {
    searchFor() {
      let event
      if (this.searchUrl.indexOf('//smash.gg/') > -1)
        event = parseSmashGGEvent(this.searchUrl)

      if (event) {
        axios
          .get(
            `/api/event/${event.service}/${event.tournamentSlug}/${event.eventSlug}/`
          )
          .then(res => {
            if (res.data && !res.data.err) {
              this.$emit('events', [res.data])
            } else {
              this.notify(
                `We didn't find an event at that URL! Check to make sure that it has /tournament/ AND /event/ in it.`
              )
            }
          })
      } else
        this.notify(
          `That URL isn't recognizable! Please enter a URL with a service we support.`
        )
    },
    getMore() {
      this.$emit('loading')
      axios.get(`/api/more/${this.game}/${this.playerId}/`).then(res => {
        if (res.data && !res.data.err) {
          this.$emit('events', [res.data])
        }
      })
    },
    notify(message) {
      this.notifyMessage = message
      setTimeout(() => {
        this.notifyMessage = null
      }, 3000)
    },
  },
}

function parseSmashGGEvent(url) {
  if (url.indexOf('tournament') && url.indexOf('event')) {
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
}
</script>

<style lang="scss">
.eventsearch {
  margin: 2em 0;
}
</style>
