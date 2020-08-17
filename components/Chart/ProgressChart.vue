<template>
  <div class="progresschart">
    <div></div>
    <div class="filters">
      <div><b>Show:</b></div>
      <div
        class="filter"
        :class="{ active: showPoints }"
        @click="showPoints = !showPoints"
      >
        <div
          class="check"
          :style="{
            color: showPoints ? `var(--l${level}d)` : '',
          }"
        >
          <span>✓</span>
        </div>
        Points
      </div>
      <div
        class="filter"
        :class="{ active: showPlacingRatio }"
        @click="showPlacingRatio = !showPlacingRatio"
      >
        <div
          class="check"
          :style="{
            color: showPlacingRatio ? 'var(--l8)' : '',
          }"
        >
          <span>✓</span>
        </div>
        Placing Ratio
      </div>
      <div
        class="filter"
        :class="{ active: showWinRatio }"
        @click="showWinRatio = !showWinRatio"
      >
        <div
          class="check"
          :style="{
            color: showWinRatio ? 'var(--l11)' : '',
          }"
        >
          <span>✓</span>
        </div>
        Win Ratio
      </div>
    </div>
    <div class="ylabelholder" :style="{ height: height + 'px' }">
      <template v-if="showPoints">
        <div
          class="label"
          v-for="label in yLabels"
          :key="'yl' + label.text"
          :style="{ top: label.top * 100 + '%' }"
        >
          {{ label.text }}
        </div>
      </template>
      <div
        v-if="showWinRatio || showPlacingRatio"
        class="label"
        :class="{ overgraph: showPoints, sub: showPoints }"
        :style="{ top: 50 + '%' }"
      >
        50%
      </div>
      <div
        v-if="!showPoints && (showWinRatio || showPlacingRatio)"
        class="label"
        :style="{ top: 75 + '%' }"
      >
        25%
      </div>
      <div
        v-if="!showPoints && (showWinRatio || showPlacingRatio)"
        class="label"
        :style="{ top: 25 + '%' }"
      >
        75%
      </div>
    </div>
    <div class="whitefade"></div>
    <div class="mainpanel" ref="mainpanel">
      <svg :width="width" :height="height" class="graph" ref="graph">
        <transition name="fadefast">
          <g v-if="showPoints">
            <path
              v-for="(path, index) in playerPointPaths"
              :key="'pp' + index"
              :style="{ fill: `var(--l${index + 1})` }"
              class="points"
              :d="path"
            />
            <path
              v-if="rivalPointPath"
              class="points rival"
              :d="rivalPointPath"
            />
          </g>
        </transition>
        <transition name="fadefast">
          <g v-if="showWinRatio">
            <path
              v-if="showWinRatio"
              class="ratio"
              :d="playerWinRateLinePath"
            />
            <path
              v-if="showWinRatio && rivalWinRateLinePath"
              class="ratio rival"
              :d="rivalWinRateLinePath"
            />
          </g>
        </transition>
        <transition name="fadefast">
          <g v-if="showPlacingRatio">
            <path class="placing" :d="playerPlacingLinePath" />
            <path
              v-if="rivalPlacingLinePath"
              class="placing rival"
              :d="rivalPlacingLinePath"
            />
          </g>
        </transition>
        <transition name="fadefast">
          <g v-if="showWinRatio || showPlacingRatio">
            <path
              class="mid thick"
              :d="`M 0,${height / 2} L ${width},${height / 2}`"
            />
            <path
              v-if="!showPoints"
              class="mid"
              :d="`M 0,${height / 4} L ${width},${height / 4}`"
            />
            <path
              v-if="!showPoints"
              class="mid"
              :d="`M 0,${(height / 4) * 3} L ${width},${(height / 4) * 3}`"
            />
          </g>
        </transition>
      </svg>
      <div class="xlabelholder" :style="{ width: width + 'px' }">
        <div
          class="label"
          v-for="(label, index) in xYearLabels"
          :key="'xyl' + label.text + index"
          :style="{ left: label.left * 100 + '%' }"
        >
          {{ label.text }}
        </div>
        <div
          class="label sub"
          v-for="(label, index) in xMonthLabels"
          :key="'xml' + label.text + index"
          :style="{ left: label.left * 100 + '%' }"
        >
          {{ label.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import levels from '~/common/levels'

export default {
  props: {
    pointsData: { default: () => [] },
    winRateData: { default: () => [] },
    placingData: { default: () => [] },
  },

  data() {
    return {
      width: 0,
      height: 200,
      containerWidth: 0,
      scrollLeft: 0,
      labelWidth: 100,
      labelHeight: 40,
      xYearLabels: [],
      xMonthLabels: [],
      yLabels: [],
      endDate: Date.now(),
      xAxisPixelToDayRatio: 1.2,
      levels,
      showPoints: true,
      showWinRatio: false,
      showPlacingRatio: false,
    }
  },

  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },

    level() {
      return this.$store.state.player.level.level
    },

    startDate() {
      const buffer = 8000000000
      if (!this.pointsData) return Date.now() - 1
      return this.pointsData.reduce(
        (lowest, { data }) =>
          data[0].date - buffer < lowest ? data[0].date - buffer : lowest,
        Infinity,
      )
    },

    timeSpan() {
      return this.endDate - this.startDate
    },

    maxY() {
      return (
        Math.max(
          ...this.pointsData.map(
            player => player.data[player.data.length - 1].y,
          ),
        ) * 1.15
      )
    },

    playerPointPaths() {
      const data = this.playerPointsData.data
      if (!data.length) return ''
      let paths = []
      let prevYAdj = 0,
        prevLevelYAdjStart = this.height,
        prevX = 0
      let currentPath = `M ${Math.round(
        ((data[0].date - this.startDate) / this.timeSpan) * this.width,
      )},${this.height} `
      let currentLevel = 0
      for (let index in data) {
        const fromStartDate = data[index].date - this.startDate
        const x = Math.round((fromStartDate / this.timeSpan) * this.width)
        const y = data[index].y
        const yAdj = Math.round(this.height - (y / this.maxY) * this.height)
        if (x === prevX && yAdj === prevYAdj && index !== data.length - 1)
          continue

        if (y <= levels[currentLevel + 1].points)
          currentPath += `L ${x},${yAdj} `

        if (index == data.length - 1) {
          currentPath += `L ${this.width},${yAdj} L ${this.width},${prevLevelYAdjStart} Z` // finish off current section at previous point value
          paths.push(currentPath)
        } else if (y > levels[currentLevel + 1].points) {
          const nextLevelYAdjStart = Math.round(
            this.height -
              (levels[currentLevel + 1].points / this.maxY) * this.height,
          )
          currentPath += `L ${prevX},${nextLevelYAdjStart} L ${this.width},${nextLevelYAdjStart} L ${this.width},${prevLevelYAdjStart} Z` // finish off current section at previous point value
          paths.push(currentPath)

          currentPath = `M ${prevX},${nextLevelYAdjStart} L ${x},${nextLevelYAdjStart} L ${x},${yAdj} `

          currentLevel++
          prevLevelYAdjStart = Math.round(
            this.height -
              (levels[currentLevel].points / this.maxY) * this.height,
          )
        }
        prevYAdj = yAdj
        prevX = x
      }
      return paths
    },
    rivalPointPath() {
      if (!this.rivalPointsData || !this.rivalPointsData.data.length) return ''
      const data = this.rivalPointsData.data
      let path = `M ${Math.round(
        ((data[0].date - this.startDate) / this.timeSpan) * this.width,
      )},${this.height} `
      let prevX, prevYAdj
      for (let index in data) {
        const fromStartDate = data[index].date - this.startDate
        const x = Math.round((fromStartDate / this.timeSpan) * this.width)
        const y = data[index].y
        const yAdj = Math.round(this.height - (y / this.maxY) * this.height)
        if (x === prevX && yAdj === prevYAdj && index !== data.length - 1)
          continue

        path += `L ${x},${yAdj} `

        if (index == data.length - 1) {
          path += `L ${this.width},${yAdj} L ${this.width},${this.height} Z` // finish off current section at previous point value
        }
        prevX = x
        prevYAdj = yAdj
      }
      return path
    },

    playerPlacingLinePath() {
      return this.calculatePlacingLinePath(this.placingData[0])
    },
    rivalPlacingLinePath() {
      if (this.rivalPointsData)
        return this.calculatePlacingLinePath(this.placingData[1])
    },

    playerWinRateLinePath() {
      return this.calculateWinRateLinePath(this.winRateData[0])
    },
    rivalWinRateLinePath() {
      if (this.rivalPointsData)
        return this.calculateWinRateLinePath(this.winRateData[1])
    },

    playerPointsData() {
      return this.pointsData[0]
    },
    rivalPointsData() {
      return this.pointsData[1]
    },
  },

  watch: {
    width(a, b) {
      if (a !== b) {
        this.recalculateXLabels()
        this.recalculateYLabels()
        this.$nextTick(this.resetChartSize)
      }
    },
    height(a, b) {
      if (a !== b) {
        this.recalculateXLabels()
        this.recalculateYLabels()
        this.$nextTick(this.resetChartSize)
      }
    },
    async pointsData() {
      this.recalculateXLabels()
      this.recalculateYLabels()
      await this.$nextTick()
      this.resetChartSize()
      await this.$nextTick()
      this.$refs.mainpanel.scrollLeft = 10000000
    },
  },

  async mounted() {
    window.addEventListener('resize', this.resetChartSize)

    await this.$nextTick()
    this.resetChartSize()

    await this.$nextTick()
    this.$refs.mainpanel.scrollLeft = 10000000
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.resetChartSize)
  },

  methods: {
    resetChartSize() {
      this.width = Math.max(
        parseInt(this.$refs.mainpanel.offsetWidth),
        Math.round(
          (this.timeSpan / 1000 / 60 / 60 / 24) * this.xAxisPixelToDayRatio,
        ),
      )
      this.height = this.isMobile ? 150 : 200
      this.containerWidth = parseInt(this.$refs.mainpanel.offsetWidth)
    },

    calculatePlacingLinePath(data) {
      if (data.length < 2) return
      let path = `M 0,${Math.round(this.height - data[0].ratio * this.height)} `
      for (let d of data) {
        const fromStartDate = d.date - this.startDate
        const x = Math.round((fromStartDate / this.timeSpan) * this.width)
        path += `L ${x},${Math.round(this.height - d.ratio * this.height)} `
      }
      path += `L ${this.width},${Math.round(
        this.height - data[data.length - 1].ratio * this.height,
      )} `
      return path
    },

    calculateWinRateLinePath(data) {
      if (data.length < 2) return
      let path = `M 0,${Math.round(this.height - data[0].ratio * this.height)} `
      for (let d of data) {
        const fromStartDate = d.date - this.startDate
        const x = Math.round((fromStartDate / this.timeSpan) * this.width)
        path += `L ${x},${Math.round(this.height - d.ratio * this.height)} `
      }
      path += `L ${this.width},${Math.round(
        this.height - data[data.length - 1].ratio * this.height,
      )} `
      return path
    },

    recalculateYLabels() {
      let labels = []
      const numOfLabels =
        (this.height - this.labelHeight) / this.labelHeight - 1
      for (let i = 1; i < numOfLabels; i++) {
        let roundedValue = Math.floor(((this.maxY / numOfLabels) * i) / 50) * 50
        if (!labels.find(l => l.text === roundedValue))
          labels.push({ text: roundedValue, top: 1 - roundedValue / this.maxY })
      }
      let roundedMax = Math.floor(this.maxY / 50) * 50
      if (!labels.find(l => l.text === roundedMax))
        labels.push({ text: roundedMax, top: 1 - roundedMax / this.maxY })
      this.yLabels = labels
    },

    recalculateXLabels() {
      const maxLabels = Math.floor(this.timeSpan / 1000 / 60 / 60 / 24 / 365)

      const functionalWidth = Math.round(
        (this.timeSpan / 1000 / 60 / 60 / 24) * this.xAxisPixelToDayRatio,
      )
      let numOfLabels = Math.min(
        maxLabels,
        (functionalWidth - this.labelWidth) / this.labelWidth,
      )
      // if (numOfLabels < 3) numOfLabels = 3

      const yearLabels = []
      let currentYear = new Date().getFullYear()
      const lastYear = new Date(this.startDate).getFullYear()
      const datePointer = new Date()
      datePointer.setMonth(0)
      datePointer.setDate(1)
      while (currentYear > lastYear - 1) {
        datePointer.setFullYear(currentYear)
        const pos = datePointer.getTime()
        yearLabels.push({
          text: datePointer.toLocaleDateString(undefined, { year: 'numeric' }),
          left: (pos - this.startDate) / this.timeSpan,
        })
        currentYear--
      }
      this.xYearLabels = yearLabels

      const monthLabels = []
      const years = yearLabels.length
      const datePointer2 = new Date()
      datePointer2.setDate(1)
      for (let l = 0; l < years; l++) {
        datePointer2.setFullYear(parseInt(yearLabels[l].text))
        for (let i = 1; i < 12; i++) {
          datePointer2.setMonth(i)
          const pos = datePointer2.getTime()
          monthLabels.push({
            text: datePointer2.toLocaleDateString(undefined, {
              month: 'short',
            }),
            left: (pos - this.startDate) / this.timeSpan,
          })
        }
      }
      this.xMonthLabels = monthLabels
    },
  },
}
</script>

<style lang="scss" scoped>
.progresschart {
  position: relative;
  width: 100%;
  color: var(--text);
  display: grid;
  grid-template-columns: 50px 1fr;
  overflow: hidden;

  @media (max-width: 768px) {
    grid-template-columns: 45px 1fr;
  }

  --tickColor: #bbb;
}

.filters {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 0.4em;
  grid-column: 1/-1;
  @media (max-width: 768px) {
    padding: 0.4em 0;
  }

  & > div:not(.filter) {
    padding-right: 0.8em;

    @media (max-width: 768px) {
      padding: 0.4em;
    }
  }

  .filter {
    cursor: pointer;
    user-select: none;
    position: relative;
    padding: 0.5em 0.8em 0.5em 0.8em;
    line-height: 1.2;
    display: flex;
    transition: background 0.2s;
    border-radius: 0.3em;

    @media (max-width: 768px) {
      padding: 0.5em;
    }

    .check {
      position: relative;
      top: 1px;
      border: 1px solid var(--grayd2);
      color: transparent;
      width: 1.1em;
      height: 1.1em;
      margin-right: 0.3em;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &:hover {
      background: var(--gray);
    }
  }
}

.xlabelholder,
.ylabelholder {
  color: var(--grayd3);
  font-weight: 600;
  font-size: 0.85em;
  text-transform: uppercase;
}

.ylabelholder {
  position: relative;
  left: 1px;
  z-index: 4;
  width: 100%;
  border-right: 1px solid var(--tickColor);

  .label {
    right: 0;
    padding-right: 3px;
    min-width: 15px;
    text-align: right;
    border-top: 1px solid var(--tickColor);

    &.overgraph {
      left: 110%;
      transform: translateY(-50%);
      right: auto;
      border: none;
      mix-blend-mode: multiply;
    }
  }
}

.whitefade {
  position: absolute;
  z-index: 2;
  background: linear-gradient(to right, white, transparent);
  width: 10%;
  pointer-events: none;
  height: 100%;
  left: 30px;
}

.mainpanel {
  position: relative;
  width: 100%;
  overflow-y: hidden;
  overflow-x: auto;
  display: grid;
  grid-template-columns: 1fr;
}

svg.graph {
  margin-right: 30px;

  path {
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .points {
    opacity: 1;
    stroke: none;

    &.rival {
      fill: var(--grayd2);
    }
  }
  .ratio {
    mix-blend-mode: multiply;
    stroke: var(--l11);
    fill: none;
    stroke-width: 4px;

    &.rival {
      stroke: var(--grayd2);
    }
  }
  .placing {
    mix-blend-mode: multiply;
    stroke: var(--l8);
    fill: none;
    stroke-width: 4px;

    &.rival {
      stroke: var(--grayd2);
    }
  }

  .mid {
    mix-blend-mode: multiply;
    stroke: #0001;
    fill: none;
    stroke-width: 1.5px;
    stroke-dasharray: 3 3;

    &.thick {
      stroke: #0002;
    }
  }
}

.xlabelholder {
  margin-right: 30px;
  position: relative;
  z-index: 3;
  border-top: 1px solid var(--tickColor);
  overflow-x: hidden;
  height: 35px;

  @media (max-width: 768px) {
    height: 30px;
  }

  .label {
    &:first-child {
      position: relative;
    }
    // transform: rotate()
    white-space: nowrap;
    top: 0;
    padding-left: 3px;
    border-left: 1px solid var(--tickColor);
  }
}

.label {
  position: absolute;

  &.sub {
    top: 1px;
    border: none;
    opacity: 0.5;
    font-size: 0.85em;
    letter-spacing: -0.03em;
  }
}
</style>
