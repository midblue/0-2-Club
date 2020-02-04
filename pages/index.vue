<template>
  <section>
    <div>
      <div class="header">
        <h1>
          Welcome to
          <br />the club.
        </h1>
      </div>
      <h3>
        Track your progress, keep improving, and stay motivated —
        <br />An
        <span class="highlight">esports fitbit</span> for anyone getting started
        in competitive gaming.
      </h3>

      <PanelButton>
        <div class="mainselector">
          <!-- Tag -->
          <div class="tag">
            <input v-model="inputTag" placeholder="Your tag" />
          </div>
          <div class="sub">&nbsp;&nbsp;(No team name necessary!)</div>

          <!-- Game -->
          <div class="game">
            <ModelSelect :options="gameOptions" v-model="inputGame" placeholder="Your game" />
          </div>
        </div>
        <template #button>
          <button class="fullsize" @click="go">Go</button>
        </template>
      </PanelButton>

      <!-- <div class="sub negmartop">{{ players }} players and {{ events }} events analyzed so far.</div> -->

      <br />
      <br />
      <div>
        <b>See it in action:</b>
        <nuxt-link to="/g/Super%20Smash%20Bros.%20Melee/t/H0P">H0P</nuxt-link>・
        <nuxt-link to="/g/Super%20Smash%20Bros.%20Ultimate/t/Zaheer">Zaheer</nuxt-link>・
        <nuxt-link to="/g/Super%20Smash%20Bros.%20Ultimate/t/ChunkyKong">ChunkyKong</nuxt-link>
      </div>

      <br />
      <br />
      <hr />
      <br />
      <br />

      <div class="intro">
        <div class="text">
          <h3>See Your Growth</h3>If you feel like you've been leveling up this year, now you can prove
          it. Your progress is charted over time, and you can compare your
          growth with your peers.
        </div>

        <div class="text">
          <h3>Points for All</h3>In training, victory isn't as important as growth and consistency.
          Lose a tight set to a strong player? That's worth some points. Support
          your local scene? Points city.
        </div>

        <div class="text">
          <h3>Easy Data Handling</h3>Just link us one tournament with you in it, and we'll automatically
          snag more. Currently supports all 1v1 tournaments for any game hosted
          through smash.gg.
        </div>
      </div>

      <br />
      <br />
      <hr />
      <br />
      <br />

      <div class="patchnotes">
        <h3>Patch Notes</h3>
      </div>
    </div>
  </section>
</template>

<script>
import axios from '~/plugins/axios'
import PanelButton from '~/components/PanelButton'
import { ModelSelect } from 'vue-search-select'
const { parseParticipantTag } = require('~/common/f').default

export default {
  scrollToTop: true,
  async asyncData() {
    let { data } = await axios.get(`/api/stats`)
    return data
  },
  head() {
    return {
      title: 'Users',
    }
  },
  components: { PanelButton, ModelSelect },
  data() {
    return {
      inputGame: {
        value: '',
        text: '',
      },
      inputTag: '',
      gameOptions: [],
    }
  },
  mounted() {
    this.gameOptions = this.games.map(g => ({ value: g, text: g }))
  },
  methods: {
    go() {
      const tag = parseParticipantTag(this.inputTag)
      if (!tag) return this.notify('You need to enter a tag!')
      if (!this.inputGame.value) return this.notify('You need to pick a game!')
      return this.$router.push(
        `/g/${encodeURIComponent(this.inputGame.value)}/t/${encodeURIComponent(
          tag
        )}`
      )
    },
    notify(message) {
      this.$store.dispatch('notifications/notify', message)
    },
  },
}
</script>

<style scoped lang="scss">
.header {
  padding-top: 1px;
}

.negmartop {
  margin-top: -40px;
}

.mainselector {
  position: relative;

  .tag {
    margin-top: 3px;
    font-size: 4em;

    input {
      font-weight: 600;
      max-width: 100%;
      line-height: 0.6;
      padding: 3px 5px 0px 5px;
    }
  }

  .game {
    font-weight: 600;
    font-size: 1.8em;
    margin-top: 40px;
    margin-bottom: 20px;
  }
}

.intro {
  .text {
    max-width: 400px;
    margin-bottom: 50px;
  }
}

.fullsize {
  margin: 0;
  width: 100%;
  height: 100%;
}
</style>
