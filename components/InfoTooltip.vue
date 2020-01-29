<template>
  <div class="infotooltip">
    <button
      class="icon low"
      @mouseover="show = true"
      @mouseout="show=false"
      @focus="show=true"
      @blur="show=false"
    >?</button>

    <transition name="fade">
      <div class="tooltip" v-if="show">
        <slot></slot>
      </div>
    </transition>
  </div>
</template>

<script>
export default {
  data() {
    return {
      show: false,
    }
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
  width: 30px;
}
.icon {
  font-size: 1rem;
  line-height: 1;
  font-weight: bold;
  cursor: help;
  padding: 7px 12px;
  margin: 0;
  user-select: none;
  outline: none;
  position: absolute;
  top: 0;
  left: 0;
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
  padding: 6px 14px;
  background: hsla(0, 0%, 0%, 0.8);
  color: var(--bg);
}
</style>
