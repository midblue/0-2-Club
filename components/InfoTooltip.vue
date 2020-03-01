<template>
  <div class="infotooltip">
    <button
      class="icon low"
      @mouseover="show = true"
      @mouseout="show = false"
      @click="show = true"
      v-on-clickaway="() => (show = false)"
    >
      <span class="textlabel">?</span>
    </button>

    <transition name="fade">
      <div
        class="tooltip"
        v-if="show"
        ref="tooltip"
        :style="tooltipStyle"
      >
        <slot></slot>
      </div>
    </transition>
  </div>
</template>

<script>
import { mixin as clickaway } from 'vue-clickaway2'

export default {
  data() {
    return {
      show: false,
      tooltipStyle: {},
    }
  },
  mixins: [clickaway],
  computed: {
    winWidth() {
      return this.$store.state.winWidth
    },
  },
  watch: {
    show() {
      this.recalcTooltipStyle()
    },
    winWidth() {
      this.recalcTooltipStyle()
    },
  },
  methods: {
    recalcTooltipStyle() {
      if (!this.show) return (this.tooltipStyle = {})
      this.$nextTick(() => {
        const { right } = this.$refs.tooltip.getBoundingClientRect()
        if (right > this.winWidth)
          return (this.tooltipStyle = {
            left: -1 * (right - this.winWidth) - 10 + 'px',
            top: '25px',
          })
        return (this.tooltipStyle = {})
      })
    },
  },
}
</script>

<style scoped lang="scss">
.infotooltip {
  position: relative;
  top: 0;
  left: 0;
  display: inline-block;
  vertical-align: top;
  line-height: 1;
  width: 25px;
}
.icon {
  font-size: 1rem;
  line-height: 1;
  font-weight: bold;
  cursor: help;
  padding: 2px 7px;
  margin: 0;
  user-select: none;
  outline: none;
  position: absolute;
  top: 0;
  left: 0;

  .textlabel {
    opacity: 0.7;
    pointer-events: none;
  }
}
.tooltip {
  position: absolute;
  pointer-events: none;
  // top: 0;
  left: 100%;
  z-index: 2000;
  line-height: 1.3;
  font-size: 0.9rem;
  width: 200px;
  font-weight: 400;
  padding: 10px 20px;
  background: hsla(0, 0%, 0%, 0.8);
  color: var(--bg);
}
</style>
