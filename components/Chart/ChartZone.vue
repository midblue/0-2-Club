<template>
  <div class="chartzone panel" :class="{ padb: !peers.length }">
    <div class="chartholder">
      <!-- <line-chart
        class="chart"
        :chart-data="pointsData"
        :options="options"
        @chart:render="chartIsReady = true"
      ></line-chart> -->
      <ProgressChart
        class="chart"
        :pointsData="pointsData"
        :winRateData="winRateData"
        :placingData="placingData"
      />
    </div>

    <div v-if="peers.length" class="compare">
      <div class="comparelabel">
        <b>Compare to Peers</b>
      </div>
      <div>
        <span
          v-for="peer in peers"
          :key="peer.id"
          class="comparetotag"
          :class="{ active: rival && rival.id == peer.id }"
          @click="
            rivalSearchTag = null
            rivalSearchId = peer.id
          "
        >
          <div
            v-if="peer.img"
            :style="{
              'background-image': `url('${peer.img}')`,
            }"
            class="playericon"
          ></div>
          {{ peer.tag }}
        </span>

        <form class="search" @submit.prevent>
          <input
            v-model="inputRivalSearchTag"
            placeholder="Search for a user..."
          />
          <button
            class="low"
            type="submit"
            v-if="inputRivalSearchTag"
            @click="searchForRival"
          >
            Search
          </button>
        </form>
      </div>
      <div class="clear">
        <button class="low" v-if="rival" @click="resetRival">Clear</button>
      </div>
    </div>
  </div>
</template>

<script>
import levels from '~/common/levels'
import ProgressChart from '~/components/Chart/ProgressChart'
import LineChart from './LineChart.js'
import axios from 'axios'

// todo really wish peers linked to their page here
// todo avg. win/loss ratio line chart
// todo not always updating with player update? might be temporary issue

export default {
  props: {},
  components: { LineChart, ProgressChart },
  data() {
    return {
      rival: null,
      inputRivalSearchTag: null,
      rivalSearchId: null,
      pointsData: [],
      winRateData: [],
      placingData: [],
    }
  },
  computed: {
    peers() {
      return this.$store.state.player.peers
    },
    player() {
      return this.$store.state.player
    },
    level() {
      return this.$store.state.player.level.level
    },
  },
  watch: {
    player() {
      this.fillData()
    },
    level() {
      this.fillData()
    },
    rival(newRival, oldRival) {
      if (newRival && newRival.id) {
        if (oldRival && oldRival.id === newRival.id) return
        this.getRivalPoints()
      } else {
        this.resetRival()
      }
    },
    rivalSearchId() {
      this.getRivalPoints()
    },
  },

  mounted() {
    this.fillData()
  },

  beforeDestroy() {},

  methods: {
    fillData() {
      const pointsToUse = getAllPoints(this.player)
      let rivalPointsToUse
      if (this.rival) rivalPointsToUse = getAllPoints(this.rival)

      if (!pointsToUse || pointsToUse.length === 0) return

      const newPointsData = [
        { label: this.player.tag, data: generatePointsData(pointsToUse) },
      ]
      if (this.rival)
        newPointsData.push({
          label: this.rival.tag,
          data: generatePointsData(rivalPointsToUse),
        })
      this.pointsData = newPointsData

      const winRateData = [
        generateWinRateData(
          this.player.participatedInEvents || [],
          this.player.id,
        ),
      ]
      if (this.rival)
        winRateData.push(
          generateWinRateData(
            this.rival.participatedInEvents || [],
            this.rival.id,
          ),
        )
      this.winRateData = winRateData

      const placingData = [
        generatePlacingData(this.player.participatedInEvents || []),
      ]
      if (this.rival)
        placingData.push(
          generatePlacingData(this.rival.participatedInEvents || []),
        )
      this.placingData = placingData
    },

    getRivalPoints() {
      this.$store.commit('setIsLoading', true)
      const pointsURL = `/api/player/${
        this.player.game
      }/id/${encodeURIComponent(this.rivalSearchId)}/`
      axios.get(pointsURL).then(res => {
        if (res.data && !res.data.err) {
          this.$nextTick(() => {
            this.rival = res.data
            this.fillData()
          })
        }
        this.$store.commit('setIsLoading', false)
      })
    },

    searchForRival() {
      this.$store.commit('setIsLoading', true)
      if (!this.inputRivalSearchTag)
        return this.$store.dispatch(
          'notifications/notify',
          `Input a player tag to compare to.`,
        )
      const url = `/api/player/${this.player.game}/tag/${encodeURIComponent(
        this.inputRivalSearchTag,
      )}/`
      axios.get(url).then(res => {
        this.$store.commit('setIsLoading', false)
        if (!res.data || res.data.err) {
          this.rival = null
          this.$store.dispatch(
            'notifications/notify',
            `No user found by the tag ${this.inputRivalSearchTag}.`,
          )
          this.fillData()
          return
        }
        if (res.data.disambiguation) {
          this.rivalSearchId = res.data.disambiguation[0].id
          this.getRivalPoints()
          return
        }

        this.rival = res.data
        this.fillData()
      })
    },

    resetRival() {
      this.rival = null
      this.rivalSearchId = null
      this.fillData()
    },
  },
}

function getAllPoints(player) {
  return [
    ...(player.participatedInEvents || []).reduce(
      (acc, event) => [
        ...acc,
        ...(event.points || []).map(p => ({
          ...p,
          eventName: event.name,
          tournamentName: event.tournamentName,
          eventSlug: event.eventSlug,
          tournamentSlug: event.tournamentSlug,
        })),
      ],
      [],
    ),
    ...(player.awards || []).reduce(
      (acc, award) => [
        ...acc,
        { date: award.date / 1000, value: award.points },
      ],
      [],
    ),
  ]
    .filter(a => a)
    .sort((a, b) => a.date - b.date)
}

function generatePointsData(points) {
  let runningTotal = 0
  return [
    { date: points[0].date * 1000 - 1000000000, y: 0 },
    ...points.map(point => {
      runningTotal += point.value
      return { date: point.date * 1000, y: runningTotal }
    }),
    { date: Date.now(), y: runningTotal },
  ]
}

function generateWinRateData(events, playerId) {
  const data = []
  const batchSize = Math.ceil(events.length / 2)
  let positionInBatch = 0,
    wins = 0,
    totalCounted = 0,
    currentEvent
  for (let event of events) {
    currentEvent = event
    for (let match of event.matchesWithUser) {
      if (match.winnerId === playerId) wins++
      positionInBatch++
      totalCounted++
      if (positionInBatch > batchSize) {
        data.push({
          date: event.date * 1000,
          ratio: wins / positionInBatch,
        })
        positionInBatch = 0
        wins = 0
      }
    }
  }
  if (positionInBatch > batchSize / 6)
    data.push({
      date: currentEvent.date * 1000,
      ratio: wins / positionInBatch,
    })

  return data
}

function generatePlacingData(events) {
  const data = []
  const batchSize = Math.ceil(events.length / 10)
  let positionInBatch = 0,
    avgPlacing = 0,
    totalCounted = 0,
    currentEvent
  for (let event of events) {
    currentEvent = event
    const currPlacing = event.standing / event.totalParticipants
    positionInBatch++
    avgPlacing =
      (currPlacing + avgPlacing * (positionInBatch - 1)) / positionInBatch
    if (positionInBatch >= batchSize) {
      data.push({
        date: event.date * 1000,
        ratio: 1 - avgPlacing,
      })
      positionInBatch = 0
      avgPlacing = 0
    }
  }
  if (positionInBatch > batchSize / 6)
    data.push({
      date: currentEvent.date * 1000,
      ratio: 1 - avgPlacing,
    })
  return data
}
</script>

<style lang="scss">
.chartzone {
  border: none;
  margin: 0;
  padding: 0;
  transition: all 0.3s;

  &.padb {
    padding-bottom: 30px;
  }
}

.chartholder {
  position: relative;
  // padding: 30px;
  // margin-bottom: -15px;

  @media (max-width: 768px) {
    // padding: 20px 20px 0 20px;
    margin-bottom: 0;
  }
}

.compare {
  display: flex;
  // margin-top: 30px;
  padding: 18px 40px 18px 40px;
  line-height: 1.6;
  background: var(--gray);

  @media (max-width: 768px) {
    display: block;
    // margin-top: 10px;
    padding: 15px 20px 18px 20px;
  }
  @media (min-width: 767px) {
    & > *:not(:last-child) {
      margin-right: 10px;
    }
    & > *:first-child {
      position: relative;
      width: 70px;
      flex-shrink: 0;
      margin-right: 20px;
    }
  }

  .comparelabel {
    margin-top: 2px;
    margin-bottom: 4px;
    line-height: 1.2;
  }

  .clear {
    flex-grow: 0;
    flex-shrink: 1;

    button {
      height: 100%;
      width: 100%;
      margin: 0;

      @media (max-width: 768px) {
        margin: 5px 0 0 0;
      }
    }
  }
}
.comparetotag {
  cursor: pointer;
  transition: all 0.2s;
  padding: 2px 6px;
  margin: 0 4px 4px 0;
  background: var(--gray);
  display: inline-block;
  border-radius: 5px;

  &:hover {
    background: var(--grayd);
  }

  &.active {
    background: gray;
    color: white;
  }
}

form.search {
  position: relative;
  display: inline-flex;
  align-items: stretch;
  height: 2em;

  button.low {
    margin: 0;
    height: 100%;
    padding: 0 30px !important;
  }
  input {
    flex: 1;
    padding: 9px 10px;
  }
}
</style>
