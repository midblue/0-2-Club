<template>
  <section>
    <div>
      <div class="header">
        <h1>Welcome to the club.</h1>
      </div>
      <h3>
        Track your progress, keep improving, and stay motivated —
        <br />An
        <span class="highlight">esports fitbit</span> for
        anyone getting started in competitive gaming.
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

      <!-- <div class="sub negmartop">
        {{
          (Object.values(players) || []).reduce(
            (total, p) => total + (p || 0),
            0
          )
        }}
        players and
        {{
          (Object.values(events) || []).reduce(
            (total, e) => total + (e || 0),
            0
          )
        }}
        events analyzed so far.
      </div>-->

      <div>
        <b>See it in action:</b>
        <nuxt-link to="/g/Super%20Smash%20Bros.%20Melee/t/H0P">H0P</nuxt-link>・
        <nuxt-link to="/g/Super%20Smash%20Bros.%20Melee/t/DoodleDork">DoodleDork</nuxt-link>・
        <nuxt-link to="/g/Super%20Smash%20Bros.%20Ultimate/t/Fluffy">Fluffy</nuxt-link>
      </div>

      <br />
      <br />
      <hr />
      <br />
      <br v-if="!isMobile" />

      <div class="intro">
        <div class="text">
          <h3>See Your Growth</h3>If you feel like you've been leveling up this year, now you
          can prove it. Your progress is charted over time, and you
          can compare your growth with your peers.
        </div>

        <div class="text">
          <h3>Points for All</h3>In training, victory isn't as important as growth and
          consistency. Lose a tight set to a strong player? That's
          worth some points. Support your local scene? Points city.
        </div>

        <div class="text">
          <h3>Easy Data Handling</h3>Just link us one tournament with you in it, and we'll
          automatically snag more. Currently supports all 1v1
          tournaments for any game hosted through smash.gg.
        </div>
      </div>

      <br />
      <br />

      <div class="patchnotes">
        <details>
          <summary>
            <h4>
              Patch Notes
              <span
                class="sub highlight"
                v-if="
                  Date.now() -
                    new Date(patchNotes[0].date).getTime() <
                    7 * 24 * 60 * 60 * 1000
                "
              >New!</span>
            </h4>
          </summary>
          <div v-for="(patch, index) in patchNotes" :key="index">
            <div class="sub">{{ new Date(patch.date).toLocaleDateString() }}</div>
            <div>{{ patch.content }}</div>
          </div>
        </details>
      </div>
    </div>
  </section>
</template>

<script>
import axios from '~/plugins/axios'
import PanelButton from '~/components/PanelButton'
import { ModelSelect } from 'vue-search-select'
const { parseParticipantTag } = require('~/common/functions').default
const patchNotes = require('~/assets/patchNotes').default

export default {
  scrollToTop: true,
  async asyncData({ req }) {
    if (req)
      require('~/api/data/scripts/log')('page:home', 'gray')(
        req.headers['x-forwarded-for']
          ? req.headers['x-forwarded-for'].split(/, /)[0]
          : req.connection.remoteAddress || req.socket.remoteAddress
      )
    let { data } = await axios.get(`/api/stats`)
    return data
  },
  head() {
    return {
      meta: [
        {
          property: 'og:title',
          hid: `og:title`,
          content: 'Home | The 0-2 Club',
        },
        {
          property: 'twitter:title',
          hid: `twitter:title`,
          content: 'Home | The 0-2 Club',
        },
        {
          hid: `og:url`,
          property: 'og:url',
          content: `https://www.0-2.club/`,
        },
      ],
    }
  },
  components: { PanelButton, ModelSelect },
  data() {
    return {
      patchNotes,
      inputGame: {
        value: '',
        text: '',
      },
      inputTag: '',
      gameOptions: [],
    }
  },
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },
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
  max-width: 500px;
}

.negmartop {
  margin-top: -40px;
}

.mainselector {
  position: relative;

  @media (max-width: 768px) {
    width: 100%;
  }

  .tag {
    margin-top: 3px;
    font-size: 4em;

    input {
      font-weight: 600;
      max-width: 100%;
      line-height: 0.6;
      padding: 3px 5px 0px 5px;
    }

    @media (max-width: 768px) {
      font-size: 2.5em;
      width: 100%;
    }
  }

  .game {
    font-weight: 600;
    font-size: 1.8em;
    margin-top: 40px;
    margin-bottom: 20px;

    @media (max-width: 768px) {
      font-size: 1.2em;
      max-width: 100%;
    }
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

.patchnotes {
  details {
    summary {
      * {
        display: inline-block;
        margin: 0;
      }
    }
  }
}
</style>
