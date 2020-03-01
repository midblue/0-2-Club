<template>
  <section>
    <div class="tag">
      <h1 class="inline">
        <div class="sub">{{ player.game }}</div>
        <div
          v-if="player.img"
          :style="{ 'background-image': `url('${player.img}')` }"
          class="playericon big"
        />
        {{ player.tag || 'Id #' + player.id }}
      </h1>
    </div>

    <template v-if="!displayEvents">
      <div class="emptystate">
        <h3>No events yet!</h3>
        <div>
          Enter a URL for a tournament you've been to below!
          <br />It should look something like
          <code
            v-html="
              `https://smash.gg/tournament/<b><i>[tournament name]</i></b>/events/<b><i>[event name]</i></b>/overview`
            "
          ></code
          >.
        </div>
      </div>
    </template>

    <template v-else>
      <div class="level">
        <h3>
          <span
            class="colorpad multiply"
            :style="{ background: `var(--l${level.level})` }"
            >Level {{ level.level }} — {{ level.label }}</span
          >
          <InfoTooltip>
            Get points by competing in tournaments to level up!
          </InfoTooltip>

          <client-only>
            <social-sharing
              :url="
                window ? window.location.href : `http://www.0-2.club/`
              "
              :title="`See ${player.tag} on the The 0-2 Club`"
              :description="
                `Level ${level.level}: ${level.label} in ${player.game}`
              "
              hashtags="esports"
              inline-template
            >
              <div class="social">
                <network network="facebook">
                  <div class="facebookicon"></div>
                </network>
                <network network="twitter">
                  <div class="twittericon"></div>
                </network>
              </div>
            </social-sharing>
          </client-only>
        </h3>

        <XPBar :totalPoints="totalPoints" :events="displayEvents" />
      </div>
    </template>

    <ProgressChart
      v-if="displayEvents"
      :points="points"
      :player="player"
      :level="level.level"
      :peers="peers"
      class="chart"
    />

    <Awards v-if="awards" :awards="awards" class="awardspane" />

    <div class="eventslabel">
      <h2 v-if="displayEvents">
        Events
        <span class="sub">({{ displayEvents.length }})</span>
      </h2>

      <EventSearch
        :player="player"
        @events="addedEvents"
        @loading="checkForUpdates = true"
        class="eventsearch"
      />
    </div>
    <EventsListing
      :events="displayEvents"
      :level="level.level"
      :game="player.game"
    />

    <template v-if="peers && peers.length > 0">
      <hr />

      <div class="peers" :class="{ flex: !isMobile }">
        <div style="margin-right: 30px; flex-shrink: 0;">
          <b>Related Players</b>
        </div>
        <div>
          <span v-for="peer in peers">
            <nuxt-link
              v-if="peer"
              :to="`/g/${player.game}/i/${peer.id}`"
            >
              <div
                v-if="peer.img"
                :style="{
                  'background-image': `url('${peer.img}')`,
                }"
                class="playericon"
              ></div>
            </nuxt-link>
            <nuxt-link
              :to="`/g/${player.game}/i/${peer.id}`"
              v-html="peer.tag"
            ></nuxt-link
            >&nbsp;&nbsp;
          </span>
        </div>
      </div>
    </template>
  </section>
</template>

<script>
import InfoTooltip from '~/components/InfoTooltip'
import EventSearch from '~/components/EventSearch'
import EventsListing from '~/components/EventsListing'
import ProgressChart from '~/components/ProgressChart'
import XPBar from '~/components/XPBar'
import Stats from '~/components/Stats'
import Awards from '~/components/Awards/Awards'
import levels from '~/common/levels'
import axios from 'axios'
const calculateAwards = require('~/api/points/awards').default

export default {
  props: {
    initialPlayer: {},
  },
  components: {
    InfoTooltip,
    EventSearch,
    EventsListing,
    ProgressChart,
    XPBar,
    Stats,
    Awards,
  },
  data() {
    return {
      window: null,
      player: {},
      peers: [],
      points: [],
      awards: [],
      levels,
      checkForUpdates: false,
      checkForUpdatesInterval: null,
    }
  },
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },
    displayEvents() {
      return this.player.participatedInEvents
        ? this.player.participatedInEvents.slice().reverse()
        : null
    },
    totalPoints() {
      return (
        (this.points
          ? this.points.reduce((total, { value }) => total + value, 0)
          : 0) +
        this.awards.reduce((total, { points }) => total + points, 0)
      )
    },
    level() {
      let l = 0
      while (this.totalPoints > this.levels[l].points) l++
      if (l > 0) l--
      this.$store.commit('setPlayer', {
        level: { ...this.levels[l], level: l },
      })
      return { ...this.levels[l], level: l }
    },
  },
  watch: {
    checkForUpdates(willCheck, wasChecking) {
      if (willCheck !== wasChecking && willCheck) {
        this.checkForUpdatesInterval = setInterval(
          this.reCheckPoints,
          8000
        )
      } else {
        clearInterval(this.checkForUpdatesInterval)
      }
    },
  },
  created() {
    this.player = this.initialPlayer
    this.points = this.initialPlayer.points
    this.peers = this.initialPlayer.peers
    this.awards = calculateAwards(this.player)
    this.$store.commit('setPlayer', {
      ...this.initialPlayer,
      awards: this.awards,
    })
  },
  mounted() {
    this.window = window
  },
  beforeDestroy() {
    clearInterval(this.checkForUpdatesInterval)
  },
  methods: {
    reCheckPoints() {
      return new Promise(async resolve => {
        const url = this.player.id
          ? `/api/points/${this.player.game}/id/${this.player.id}/`
          : `/api/points/${this.player.game}/tag/${this.player.tag}/`
        await axios.get(url).then(res => {
          if (res.data && !res.data.err) {
            if (res.data.disambiguation) {
              return this.$router.replace(
                `/g/${this.player.game}/t/${this.player.tag}/disambiguation`
              )
            }
            for (let prop in res.data) {
              this.$set(this.player, prop, res.data[prop])
              this.$store.commit('setPlayer', res.data)
            }
            if (res.data.peers) this.peers = res.data.peers
            this.points = null
            this.awards = null
            this.$nextTick(() => {
              this.points = res.data.points
              this.awards = calculateAwards(this.player)
              this.$store.commit('setPlayer', {
                points: this.points,
                awards: this.awards,
              })
            })
          }
        })
      })
    },
    addedEvents(newEvents) {
      this.checkForUpdates = false
      this.reCheckPoints()
    },
  },
}
</script>

<style scoped lang="scss">
.tag {
  margin-top: 1em;
  h1 {
    margin-bottom: 0px;

    .sub {
      font-size: 0.85rem;
      margin-bottom: 10px;
    }
  }

  @media (max-width: 768px) {
    margin-top: 0em;
  }
}
.level {
  margin-top: 0.5em;
  margin-bottom: 2em;

  h3 {
    margin-top: 0;
    margin-bottom: 0px;
  }
}

.social {
  float: right;
  position: relative;
  display: flex;
}

.stats {
  margin-bottom: 2em;
}
.awardspane {
  margin-bottom: 3em;
}

.chart {
  margin-bottom: 2em;
}

.panel {
  h3 {
    margin-top: 0;
  }
}

.eventslabel {
  margin: 2em 0 0 0;
  // display: flex;
  // align-items: center;

  & > * {
    margin-top: 0;
    margin-bottom: 0;
  }

  // h2 {
  // margin-right: 0.5em;
  // }
}
.eventsearch {
  flex: 1;
}

h3 {
  line-height: 1.1;
}
</style>
