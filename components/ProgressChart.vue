<template>
  <div class="chartholder">
    <line-chart
      class="chart"
      :chart-data="datacollection"
      :options="options"
    ></line-chart>
    <span class="sub" v-if="checkForUpdates"
      >loading updated comparison...</span
    >
  </div>
</template>

<script>
import levels from '~/common/levels'
import LineChart from './LineChart.js'
import axios from 'axios'

export default {
  props: {
    points: { default: () => [] },
    rivalId: {},
    rivalSearchTag: {},
    player: {},
    level: { default: 0 },
  },
  components: { LineChart },
  data() {
    return {
      checkForUpdates: false,
      checkForUpdatesInterval: null,
      rivalIdFromSearchTag: null,
      rivalTag: null,
      rivalPoints: null,
      datacollection: {},
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
              },
              gridLines: {
                display: false,
              },
            },
          ],
          yAxes: [{ display: true }],
        },
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
    rivalId() {
      if (this.rivalId) {
        this.checkForUpdates = true
        this.rivalSearchTag = null
        this.rivalIdFromSearchTag = null
      } else {
        this.rivalTag = null
        this.rivalPoints = null
        this.fillData()
      }
    },
    rivalSearchTag() {
      if (this.rivalSearchTag) this.searchForRival()
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
            steppedLine: true,
            borderColor: 'rgba(0,0,0,0)',
            pointBackgroundColor: 'rgba(0,0,0,0)',
            pointBorderColor: 'rgba(0,0,0,0)',
            label: this.player.tag,
            backgroundColor: getComputedStyle(document.documentElement)
              .getPropertyValue('--l' + this.level)
              .replace('100%)', '80%)'),
            data,
          },
        ],
      }
      if (rivalData)
        newDatacollection.datasets.push({
          steppedLine: true,
          borderColor: 'rgba(0,0,0,0)',
          pointBackgroundColor: 'rgba(0,0,0,0)',
          pointBorderColor: 'rgba(0,0,0,0)',
          label: this.rivalTag,
          backgroundColor: 'hsla(0, 0%, 30%, 80%)',
          data: rivalData,
        })
      this.datacollection = newDatacollection
    },

    startChecking() {
      clearInterval(this.checkForUpdatesInterval)
      this.checkForUpdatesInterval = setInterval(this.reCheckPoints, 1500)
      const moreUrl = `/api/more/${this.player.game}/${this.rivalId ||
        this.rivalIdFromSearchTag}/`
      axios.get(moreUrl).then(res => {
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
      const url = `/api/player/${this.player.game}/${encodeURIComponent(
        this.rivalSearchTag
      )}/`
      axios.get(url).then(res => {
        if (!res.data || res.data.err) return
        this.rivalIdFromSearchTag = res.data.disambiguation
          ? res.data.disambiguation[0].id
          : res.data.id
        console.log(this.rivalIdFromSearchTag)
        this.checkForUpdates = true
      })
    },
  },
}

function generateData(points) {
  let runningTotal = 0
  return [
    { x: new Date(points[0].date * 1000), y: 0 },
    ...points.map(
      point => {
        runningTotal += point.value
        return { x: new Date(point.date * 1000), y: runningTotal }
      },
      { x: new Date(), y: points[points.length - 1].value }
    ),
  ]
}
</script>

<style lang="scss">
.chart {
  canvas {
    max-height: 150px;
    max-width: 600px;
  }
}
</style>
