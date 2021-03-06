<template>
  <section>
    <div class="header">
      <h1>
        Welcome to<img
          v-if="!isMobile"
          src="~/static/img/shines.svg"
          class="sparkle"
        />
        the club.
      </h1>
    </div>
    <h3>
      Track your progress, keep improving, and stay motivated —
      <br v-if="!isMobile" /><template v-if="isMobile">an</template
      ><template v-else>An</template>
      <span class="highlight">esports fitbit</span> for anyone getting started
      in competitive Melee.<!--gaming.-->
    </h3>

    <div v-if="savedEntries.length">
      <h4>Your Recent Searches</h4>
      <div
        v-for="(entry, index) in savedEntries.slice(0, 4)"
        :key="'e' + index"
        class="savedentry buttonbox"
      >
        <div class="holder" @click="go(null, entry.tag, entry.game)">
          <h3>{{ entry.tag }}</h3>
          <div class="sub">{{ entry.game }}</div>
        </div>
        <div class="delete" @click="removeEntry(entry.tag, entry.game)">
          ✖
        </div>
      </div>
    </div>

    <PanelButton style="position: relative; z-index:1;">
      <div class="mainselector">
        <!-- Tag -->
        <div class="tag">
          <input
            v-model="inputTag"
            placeholder="Your tag"
            @keydown.enter="go"
          />
        </div>
        <div class="sub">&nbsp;&nbsp;(No team name necessary!)</div>

        <!-- Game -->
        <!-- <div class="game">
            <ModelSelect
              :options="gameOptions"
              v-model="inputGame"
              placeholder="Your game"
            />
          </div> -->
      </div>
      <template #button>
        <button class="fullsize" @click="go">
          Go
        </button>
      </template>
    </PanelButton>

    <div class="colorsection">
      <div class="bgholder">
        <div class="colorbg"></div>
      </div>

      <div class="inaction" v-if="savedEntries.length === 0">
        <h3 class="sectionheader">See it in action:</h3>
        <div>
          <div
            class="savedentry invert buttonbox"
            @click="go(true, 'H0P', 'Super Smash Bros. Melee')"
          >
            <div class="holder">
              <h3>H0P</h3>
              <div class="sub">Super Smash Bros. Melee</div>
            </div>
          </div>
          <div
            class="savedentry invert buttonbox"
            @click="go(true, 'DoodleDork', 'Super Smash Bros. Melee')"
          >
            <div class="holder">
              <h3>DoodleDork</h3>
              <div class="sub">Super Smash Bros. Melee</div>
            </div>
          </div>
          <div
            class="savedentry invert buttonbox"
            @click="go(true, 'Axe', 'Super Smash Bros. Melee')"
          >
            <div class="holder">
              <h3>Axe</h3>
              <div class="sub">Super Smash Bros. Melee</div>
            </div>
          </div>
        </div>
      </div>

      <hr v-if="savedEntries.length === 0" />

      <div class="intro">
        <div class="imgholder">
          <img src="/img/home/3.png" />
        </div>
        <div class="text">
          <h3>See Your Growth</h3>
          <div>
            If you feel like you've been leveling up this year, now you can
            prove it. Your progress is charted over time, and you can compare
            your growth with your peers.
          </div>
        </div>

        <div class="imgholder right">
          <img src="/img/home/5.png" style="max-height: 200px" />
        </div>
        <div class="text left">
          <h3>Points for All</h3>
          <div>
            In training, victory isn't as important as growth and consistency.
            Lose a tight set to a strong player? That's worth some points.
            Support your local scene? Points city.
          </div>
        </div>

        <div class="imgholder">
          <img src="/img/home/4.png" />
        </div>
        <div class="text">
          <h3>Hassle-Free Data</h3>
          <div>
            Just link us one tournament with you in it, and we'll automatically
            snag more. Currently supports all 1v1 tournaments for Super Smash
            Bros. Melee.<!-- any game
            hosted through smash.gg. -->
          </div>
        </div>
      </div>

      <br />
      <br />
      <hr />
      <br />
      <br />

      <div class="patchnotes">
        <h3>Patch Notes</h3>
        <div
          v-for="(patch, index) in patchNotes.slice(0, 2)"
          :key="index"
          class="patchnote"
        >
          <div>
            <span class="sub">{{
              new Date(patch.date).toLocaleDateString()
            }}</span>
            <span
              class="highlight"
              v-if="
                Date.now() - new Date(patch.date).getTime() <
                  7 * 24 * 60 * 60 * 1000
              "
              >New!</span
            >
          </div>
          <div>{{ patch.content }}</div>
        </div>
        <details>
          <summary>
            <h4>More</h4>
          </summary>
          <div
            v-for="(patch, index) in patchNotes.slice(2)"
            :key="'hidden' + index"
            class="patchnote"
          >
            <div class="sub">
              {{ new Date(patch.date).toLocaleDateString() }}
            </div>
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
const { parseParticipantTag, parseIp } = require('~/common/functions')
const patchNotes = require('~/assets/patchNotes')
const { get, set, remove } = require('~/assets/storage')

export default {
  scrollToTop: true,
  async asyncData({ req, error }) {
    if (req) {
      const ipInfo = parseIp(req)
      if (ipInfo.log)
        require('~/server/scripts/log')('page:home', 'gray')(
          ipInfo.name || ipInfo.ip,
        )
      if (!ipInfo.allowed)
        return error({ statusCode: 404, message: 'Not found.' })
    }
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
      savedEntries: [],
    }
  },
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },
  },
  mounted() {
    this.gameOptions = this.games.map(g => ({ value: g, text: g }))
    this.$store.commit('clearPlayer')
    const saved = get('pastSearches')
    if (saved) this.savedEntries = JSON.parse(saved)
  },
  methods: {
    addSavedEntry(tag, game) {
      let saved = get('pastSearches')
      if (!saved) saved = []
      else saved = JSON.parse(saved)
      if (saved.find(s => s.tag === tag && s.game === game)) return
      saved.unshift({ tag, game })
      set('pastSearches', JSON.stringify(saved.slice(0, 5)))
    },
    removeEntry(tag, game) {
      let saved = get('pastSearches')
      if (!saved) return
      else saved = JSON.parse(saved)
      const index = saved.findIndex(s => s.tag === tag && s.game === game)
      if (index === -1) return
      saved.splice(index, 1)
      this.savedEntries = saved
      set('pastSearches', JSON.stringify(saved))
    },
    go(event, passedTag, passedGame) {
      const tag = passedTag || parseParticipantTag(this.inputTag)
      const game =
        passedGame || this.inputGame.value || 'Super Smash Bros. Melee'
      if (!tag) return this.notify('You need to enter a tag!')
      if (!game) return this.notify('You need to pick a game!')
      this.addSavedEntry(tag, game)
      return this.$router.push(
        `/g/${encodeURIComponent(game)}/t/${encodeURIComponent(tag)}`,
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
  padding-top: 10vh;
  max-width: 500px;

  h1 {
    position: relative;
  }
  .sparkle {
    display: none;
    position: relative;
    width: 60px;
    top: -30px;
    left: 5%;
  }
}

.negmartop {
  margin-top: -40px;
}

h4 {
  margin-bottom: 0.5em;
  margin-top: 3em;
}

.savedentry {
  color: var(--text);
  position: relative;
  min-width: 200px;
  cursor: pointer;
  margin-bottom: 20px;
  text-align: left;
  border-radius: var(--radius);
  overflow: hidden;

  &:not(:last-of-type) {
    margin-right: 20px;
  }

  @media (max-width: 768px) {
    margin-right: 0px !important;
  }

  &.invert {
    color: white;
    background: rgba(white, 0.2);

    &:hover {
      color: var(--text);
    }

    .sub {
      opacity: 1;
    }
  }

  .holder {
    width: 100%;
    height: 100%;
    padding: 10px 15px;
    transition: background 0.3s;

    &:hover {
      background: var(--active);
    }
  }

  .delete {
    user-select: none;
    width: 30px;
    height: 30px;
    position: absolute;
    top: 0;
    right: 0;
    background: var(--gray);
    transition: all 0.3s;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: var(--l12);
      color: white;
    }
  }

  h4,
  h3 {
    margin: 0;
  }
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

.fullsize {
  margin: 0;
  width: 100%;
  height: 100%;
  font-size: 3.5em;
}

.intro {
  margin: 130px 0;
  display: grid;
  grid-template-columns: 47% 47%;
  grid-gap: 130px 6%;
  grid-auto-flow: dense;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    grid-gap: 30px;
  }

  .imgholder {
    position: relative;
    @media (max-width: 768px) {
      display: flex;
      justify-content: center;
    }

    img {
      max-width: 100%;
      @media (max-width: 768px) {
        max-width: 85%;
      }
    }
  }

  .text {
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;

    @media (max-width: 768px) {
      padding-bottom: 50px;
    }

    h3 {
      margin-top: 0;
    }
  }

  .left {
    grid-column: 1 /2;
  }
  .right {
    grid-column: -2/-1;
  }
}

.colorsection {
  position: relative;
  color: white;

  & > * {
    position: relative;
    z-index: 1;
  }

  hr {
    border-top: 1px dashed white;
    opacity: 0.5;
  }
}

.bgholder {
  box-sizing: content-box;
  overflow: hidden;
  position: absolute;
  z-index: 0;
  top: -300px;
  left: -100vw;
  right: -100vw;
  height: 100%;
  padding-bottom: 600px;
  pointer-events: none;
}
.colorbg {
  position: absolute;
  top: 100px;
  left: -100vw;
  right: -100vw;
  bottom: -50vh;
  transform-origin: top center;
  transform: rotate(-4deg);
  background: linear-gradient(160deg, var(--l2d), var(--l2dd));
  filter: grayscale(80%) brightness(0.4);
}

.inaction {
  position: relative;
  z-index: 1;
  margin: 100px 0 80px 0;

  .sectionheader {
    width: 100%;
    text-align: center;
    margin-bottom: 1em;
  }

  & > div {
    display: flex;
    justify-content: center;
    // todo not working on mobile (obv)

    @media (max-width: 768px) {
      flex-direction: column;
      align-items: center;
    }
  }
}

h3 {
  font-size: 1.3em;
}

hr {
  max-width: 600px;
  margin: 0 auto;
}

.patchnotes {
  max-width: 600px;
  margin: 0 auto;

  h3 {
    font-size: 1.3em;
  }

  details {
    summary {
      margin-bottom: 15px;
      * {
        display: inline-block;
        margin: 0;
      }
    }
  }

  .patchnote {
    margin-bottom: 15px;
  }
}
</style>
