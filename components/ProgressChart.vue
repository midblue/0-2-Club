<template>
  <div
    class="progresschart drop"
    :class="{ ready: chartIsReady, padb: !peers.length }"
    v-if="pointsToUse.length > 0"
  >
    <div class="chartholder">
      <line-chart
        class="chart"
        :chart-data="datacollection"
        :options="options"
        @chart:render="chartIsReady = true"
      ></line-chart>
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
          :class="{ active: rivalId === peer.id }"
          @click="
            rivalSearchTag = null
            rivalId = peer.id
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
        <button class="low" v-if="rivalTag" @click="resetRival">Clear</button>
      </div>
    </div>
  </div>
</template>

<script>
import levels from '~/common/levels'
import LineChart from './LineChart.js'
import axios from 'axios'

// todo really wish peers linked to their page here
// todo avg. win/loss ratio line chart
// todo not always updating with player update? might be temporary issue

export default {
  props: {},
  components: { LineChart },
  data() {
    return {
      rivalId: null,
      inputRivalSearchTag: null,
      rivalIdFromSearchTag: null,
      rivalTag: null,
      rivalPoints: null,
      datacollection: {},
      chartIsReady: false,

      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        legend: {
          display: false,
          position: 'bottom',
        },
        scales: {
          xAxes: [
            {
              display: true,
              type: 'time',
              bounds: 'data',
              ticks: {
                source: 'auto',
                maxRotation: 40,
                autoSkipPadding: 20,
              },
              gridLines: {
                display: false,
              },
            },
          ],
          yAxes: [
            {
              display: true,
              ticks: {
                min: 0,
                // max: levels[this.level + 1].points,
                maxTicksLimit: 6,
                // callback: (value, index, values) => {
                //   if (index === 0) return 'Level ' + (this.level + 1)
                //   return value
                // },
              },
            },
          ],
        },
      },
      defaultDatasetOptions: {
        steppedLine: true,
        borderColor: 'rgba(0,0,0,0)',
        pointBackgroundColor: 'rgba(0,0,0,0)',
        pointBorderColor: 'rgba(0,0,0,0)',
      },
    }
  },
  computed: {
    points() {
      return (this.player.participatedInEvents || [])
        .reduce(
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
        )
        .sort((a, b) => a.date - b.date)
    },
    peers() {
      return this.$store.state.player.peers
    },
    player() {
      return this.$store.state.player
    },
    level() {
      return this.$store.state.player.level.level
    },
    pointsToUse() {
      return this.points || []
    },
    rivalPointsToUse() {
      return this.rivalPoints || []
    },
  },
  watch: {
    points() {
      this.fillData()
    },
    level() {
      this.fillData()
    },
    rivalId(newId, oldId) {
      if (newId) {
        this.getRivalPoints()
      } else if (newId !== oldId) {
        this.resetRival()
      }
    },
  },

  mounted() {
    this.fillData()
  },

  beforeDestroy() {},

  methods: {
    fillData() {
      if (!this.pointsToUse || this.pointsToUse.length === 0) return

      const data = generateData(this.pointsToUse)
      let rivalData
      if (this.rivalPoints) rivalData = generateData(this.rivalPointsToUse)

      // const ctx = document.getElementById('line-chart').getContext('2d')
      // const gradient = ctx.createLinearGradient(0, 120, 0, 30)
      // for (let x = 0; x <= this.level; x++) {
      //   gradient.addColorStop(
      //     (1 / this.level) * x,
      //     getComputedStyle(document.documentElement).getPropertyValue('--l' + x)
      //   )
      // }

      const newDatacollection = {
        datasets: [
          {
            ...this.defaultDatasetOptions,
            label: this.player.tag,
            backgroundColor: getComputedStyle(document.documentElement)
              .getPropertyValue('--l' + this.level)
              .replace('100%)', '75%)'),
            data,
          },
        ],
      }
      if (rivalData)
        newDatacollection.datasets.push({
          ...this.defaultDatasetOptions,
          label: this.rivalTag,
          backgroundColor: 'hsla(0, 0%, 30%, 65%)',
          data: rivalData,
        })
      this.datacollection = newDatacollection
    },

    getRivalPoints() {
      this.$store.commit('setIsLoading', true)
      const pointsURL = `/api/player/${
        this.player.game
      }/id/${encodeURIComponent(this.rivalId)}/`
      axios.get(pointsURL).then(res => {
        if (res.data && !res.data.err) {
          this.rivalTag = res.data.tag
          this.$nextTick(() => {
            this.rivalPoints = (res.data.participatedInEvents || []).reduce(
              (acc, event) => [
                ...acc,
                ...event.points.map(p => ({
                  ...p,
                  eventName: event.name,
                  tournamentName: event.tournamentName,
                  eventSlug: event.eventSlug,
                  tournamentSlug: event.tournamentSlug,
                })),
              ],
              [],
            )
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
          this.rivalId = null
          this.$store.dispatch(
            'notifications/notify',
            `No user found by the tag ${this.inputRivalSearchTag}.`,
          )
          this.fillData()
          return
        }
        if (res.data.disambiguation)
          return (this.rivalId = res.data.disambiguation[0].id)
        this.rivalTag = res.data.tag
        this.rivalPoints = (res.data.participatedInEvents || []).reduce(
          (acc, event) => [
            ...acc,
            ...event.points.map(p => ({
              ...p,
              eventName: event.name,
              tournamentName: event.tournamentName,
              eventSlug: event.eventSlug,
              tournamentSlug: event.tournamentSlug,
            })),
          ],
          [],
        )
        this.fillData()
      })
    },

    resetRival() {
      this.rivalTag = null
      this.rivalId = null
      this.rivalPoints = null
      this.fillData()
    },
  },
}

function generateData(points) {
  let runningTotal = 0
  return [
    { x: new Date(points[0].date * 1000 - 1000000000), y: 0 },
    ...points.map(point => {
      runningTotal += point.value
      return { x: new Date(point.date * 1000), y: runningTotal }
    }),
    { x: new Date(), y: points[points.length - 1].value },
  ]
}
</script>

<style lang="scss">
.progresschart {
  transition: all 0.3s;
  --chartW: 100%;
  --chartH: 150px;
  width: var(--chartW);

  & > * {
    opacity: 0;
    transition: opacity 1s;
  }

  &.ready {
    & > * {
      opacity: 1;
    }
  }

  &.padb {
    padding-bottom: 30px;
  }
}

.chartholder {
  position: relative;
  padding: 30px 30px 0 30px;

  @media (max-width: 768px) {
    padding: 20px 20px 0 20px;
  }
}
.chart {
  canvas {
    height: var(--chartH);
    max-height: var(--chartH);
    max-width: var(--chartW);
  }
}

.compare {
  display: flex;
  margin-top: 30px;
  padding: 18px 40px 18px 40px;
  line-height: 1.6;
  background: var(--grayl);

  @media (max-width: 768px) {
    display: block;
    margin-top: 10px;
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
