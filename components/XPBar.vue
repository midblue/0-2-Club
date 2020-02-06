<template>
  <div class="xpbar">
    <div class="toplabels">
      <div></div>
      <div class="end">Level {{ level.level + 1 }}</div>
    </div>
    <div class="bar">
      <div
        class="progress"
        :style="{
          background: `var(--l${level.level})`,
          width: `${displayPercent}%`,
        }"
      ></div>
    </div>
    <div class="labels">
      <div class="start">{{ level.points }}</div>
      <transition name="fade">
        <div
          class="floatinglabel"
          :style="{
            left: `${displayLabelPosition}%`,
            color: `var(--l${level.level}d)`,
            opacity: displayLabelPosition === 9.001 ? 0 : 1,
          }"
        >
          {{ totalPoints }}
          ({{ displayPercent }}%)
        </div>
      </transition>
      <div class="end">{{ levels[level.level + 1].points }}</div>
    </div>
  </div>
</template>

<script>
import levels from '~/common/levels'

export default {
  props: {
    totalPoints: {},
    events: {},
  },
  data() {
    return {
      levels,
      displayPercent: 0,
      displayLabelPosition: 9.001,
    }
  },
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },
    level() {
      let l = 0
      while (this.totalPoints > levels[l].points) l++
      if (l > 0) l--
      return { ...levels[l], level: l }
    },
    percentToNextLevel() {
      return (
        ((this.totalPoints - this.level.points) /
          (levels[this.level.level + 1].points - this.level.points)) *
        100
      )
    },
    pointsToNextLevel() {
      return (
        this.levels[this.level.level + 1].points - this.totalPoints
      )
    },
    labelPosition() {
      const buffer = this.isMobile ? 15 : 9
      let pos =
        this.displayPercent > 100 - buffer
          ? 100 - buffer
          : this.displayPercent
      if (pos < buffer) pos = buffer
      return pos
    },
  },
  watch: {
    percentToNextLevel() {
      this.$nextTick(() => {
        this.displayPercent = Math.round(this.percentToNextLevel)
        this.displayLabelPosition = this.labelPosition
      })
    },
  },
  mounted() {
    this.$nextTick(() => {
      this.displayPercent = Math.round(this.percentToNextLevel)
      this.displayLabelPosition = this.labelPosition
    })
  },
}
</script>

<style lang="scss" scoped>
.xpbar {
  margin-top: 0px;
}

.bar {
  width: 100%;
  height: 2px;
  background: var(--grayd);
  margin-bottom: 2px;
}
.progress {
  height: 300%;
  position: relative;
  top: -100%;
  transition: width 1s;
}

.toplabels {
  position: relative;
  display: flex;
  justify-content: space-between;
  font-size: 0.8em;
}

.labels {
  position: relative;
  display: flex;
  justify-content: space-between;
  // font-weight: bold;
  font-size: 0.8em;
}

.start {
  color: rgba(0, 0, 0, 0.3);
}

.floatinglabel {
  position: absolute;
  transition: left 1s, opacity 1s;
  left: 0;
  transform: translateX(-50%);
  text-align: center;
  line-height: 1;
  padding-top: 2px;
}

.end {
  color: rgba(0, 0, 0, 0.3);
}
</style>
