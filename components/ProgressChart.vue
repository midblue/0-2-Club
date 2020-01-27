<template>
  <div class="progresschart" :class="{ready: chartIsReady}">
    <div class="chartholder">
      <line-chart
        class="chart"
        :chart-data="datacollection"
        :options="options"
        @chart:render="chartIsReady = true"
      ></line-chart>
    </div>

    <div v-if="peers" class="compare">
      <div>
        <b>Compare</b>
      </div>
      <div>
        <span v-for="peer in peers">
          <span
            class="comparetotag"
            :class="{ active: rivalId === peer.id }"
            @click="
            rivalSearchTag = null
            rivalId = peer.id
          "
          >{{ peer.tag }}</span>
          &nbsp;
        </span>
        <span v-if="rivalId" @click="rivalId = null">Clear</span>
        <form class="search" @submit.prevent>
          <input v-model="inputRivalSearchTag" placeholder="Search for a user..." />
          <button class="low" type="submit" @click="
          searchForRival
        ">Compare</button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import levels from '~/common/levels'
import LineChart from './LineChart.js'
import axios from 'axios'

export default {
  props: {
    points: { default: () => [] },
    peers: {},
    player: {},
    level: { default: 0 },
  },
  components: { LineChart },
  data() {
    return {
      checkForUpdates: false,
      checkForUpdatesInterval: null,
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
    pointsToUse() {
      return (this.points || []).sort((a, b) => a.date - b.date)
    },
    rivalPointsToUse() {
      return (this.rivalPoints || []).sort((a, b) => a.date - b.date)
    },
  },
  watch: {
    points() {
      this.fillData()
    },
    rivalId(newId) {
      if (newId) {
        this.checkForUpdates = true
      } else {
        this.rivalTag = null
        this.rivalPoints = null
        this.fillData()
      }
    },

    checkForUpdates(willCheck, wasChecking) {
      if (willCheck !== wasChecking && willCheck) {
        this.startChecking()
      } else {
        clearInterval(this.checkForUpdatesInterval)
      }
    },
  },

  mounted() {
    this.fillData()
  },

  beforeDestroy() {
    clearInterval(this.checkForUpdatesInterval)
  },

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

    startChecking() {
      clearInterval(this.checkForUpdatesInterval)
      this.checkForUpdatesInterval = setInterval(this.reCheckPoints, 1500)
      this.$store.commit('setIsLoading', true)
      const moreUrl = `/api/more/${this.player.game}/${this.rivalId ||
        this.rivalIdFromSearchTag}/`
      axios.get(moreUrl).then(res => {
        this.$store.commit('setIsLoading', false)
        this.checkForUpdates = false
        this.reCheckPoints()
      })
    },

    reCheckPoints() {
      return new Promise(async resolve => {
        const url = `/api/points/${this.player.game}/id/${this.rivalId ||
          this.rivalIdFromSearchTag}/`
        await axios.get(url).then(res => {
          if (res.data && !res.data.err) {
            this.rivalTag = res.data.player.tag
            this.$nextTick(() => {
              this.rivalPoints = res.data.points
              this.fillData()
            })
          }
        })
      })
    },

    searchForRival() {
      if (!this.inputRivalSearchTag)
        return this.$store.dispatch(
          'notifications/notify',
          `Input a player tag to compare to.`
        )
      const url = `/api/player/${this.player.game}/${encodeURIComponent(
        this.inputRivalSearchTag
      )}/`
      axios.get(url).then(res => {
        if (!res.data || res.data.err) {
          this.checkForUpdates = false
          this.rivalTag = null
          this.rivalPoints = null
          this.$store.dispatch(
            'notifications/notify',
            `No user found by the tag ${this.rivalSearchTag}.`
          )
          this.fillData()
          return
        }
        this.rivalId = res.data.disambiguation
          ? res.data.disambiguation[0].id
          : res.data.id
        this.checkForUpdates = true
      })
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
  // background: rgba(0, 0, 0, 0.04);
  transition: all 0.3s;

  & > * {
    opacity: 0;
    transition: opacity 1s;
  }

  &.ready {
    background: transparent;

    & > * {
      opacity: 1;
    }
  }
}

.chartholder {
  --mapW: 100%;
  --mapH: 150px;
  max-height: var(--mapH);
  max-width: var(--mapW);
  position: relative;
}
.chart {
  canvas {
    height: var(--mapH);
    max-height: var(--mapH);
    max-width: var(--mapW);
  }
}

.compare {
  display: flex;
  margin-top: 30px;

  & > *:first-child {
    margin-right: 30px;
  }
}
.comparetotag {
  cursor: pointer;
  transition: all 0.2s;
  padding: 4px 6px;
  margin: -4px -6px;

  &:hover {
    background: #eee;
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
