<template>
  <div class="awardholder" @mouseover="hover = true" @mouseout="hover = false">
    <button
      class="award"
      :class="
        award.type +
          ' ' +
          (award.level === 0 ? 'inprogress' : '') +
          ' ' +
          (hover ? 'focus' : '') +
          ' ' +
          (fade ? 'fade' : '')
      "
      @focus="hover = true"
      @blur="hover = false"
      :style="{
        'background-color':
          award.level > 0 ? `var(--l${award.level})` : ``,
        'background-image': `url('${award.img}')`,
      }"
    >
      <div class="label">{{ award.label }}</div>

      <template v-if="award.levelProgress > 0.01">
        <svg class="progress" width="106px" height="106px" viewBox="0 0 106 106">
          <g fill="none">
            <circle
              stroke-width="7"
              :stroke-dashoffset="315 - 315 * award.levelProgress"
              cx="53"
              cy="53"
              r="50"
            />
          </g>
        </svg>
        <!-- <div class="progresslabel start">{{ award.levelStart }}</div>
        <div class="progresslabel end">{{ award.levelEnd }}</div>-->
      </template>

      <template v-if="award.level > 0">
        <div class="levellabel">{{ award.level }}</div>
        <div class="tooltip" v-if="hover">
          <h3 v-html="award.title"></h3>
          <div class="level" :style="{ color: `var(--l${award.level})` }">
            <div>
              <b>Level {{ award.level }}</b>
            </div>
            <div class="points">+{{ award.points }} points</div>
          </div>
          <div v-html="award.levelDescription"></div>
          <div class="sub">
            Reach
            <b>{{ award.levelEnd }}</b>
            for level
            {{ award.level + 1 }}
          </div>
        </div>
      </template>

      <template v-else>
        <div class="tooltip" v-if="hover">
          <h3>{{ award.title }}</h3>
          <div class="sub">(Not yet achieved)</div>
          <div v-html="award.requirements"></div>
          <div class="sub" v-html="award.bestAttemptString"></div>
        </div>
      </template>
    </button>
  </div>
</template>

<script>
export default {
  props: {
    award: {},
    fade: {},
  },
  data() {
    return {
      hover: false,
    }
  },
  watch: {
    hover(isHovering) {
      this.$emit(isHovering ? 'isHovering' : 'unhover')
    },
  },
}
</script>

<style lang="scss" scoped>
$widthu: 60px;
$width: 50px;
$widthd: 40px;
.awardholder {
  position: relative;
  width: $widthu;
  height: $width;
  padding: 0 5px;
  cursor: help;
  display: flex;
  align-items: center;
  justify-content: center;
}
.award {
  position: relative;
  width: $width;
  height: $width;
  margin: 0;
  outline: none;
  cursor: help;
  background: var(--grayl);
  border: none;
  border-radius: 50%;
  box-shadow: inset 0 -7px 15px 3px var(--gray);
  background-color: var(--grayd);
  background-repeat: no-repeat;
  background-blend-mode: hard-light;
  background-size: 100%;
  background-position: center center;
  padding: 3px;
  // color: var(--bg);
  font-size: 1.1rem;
  font-weight: bold;
  box-shadow: 0 5px 10px var(--grayd);
  transition: box-shadow 0.3s;

  &:hover,
  &:active,
  &.focus {
    box-shadow: 0 10px 20px var(--grayd2);

    .tooltip {
      z-index: 3000;
    }
  }

  &.fade {
    opacity: 0.5;

    .tooltip {
      display: none;
    }
  }
}

.label {
  font-size: 0.75em;
  // color: white;
  opacity: 0.6;
  pointer-events: none;
  position: absolute;
  top: 5%;
  left: 50%;
  transform: translateX(-50%);
  letter-spacing: -0.5px;
}

.levellabel {
  font-size: 0.9em;
  pointer-events: none;
  color: white;
  position: absolute;
  bottom: 0%;
  text-align: center;
  left: 50%;
  transform: translateX(-50%);
  letter-spacing: -0.5px;
}

.progresslabel {
  position: absolute;
  bottom: 0%;
  font-size: 0.7em;
  opacity: 0.6;
  font-weight: normal;
  line-height: 1;

  &.end {
    left: 95%;
  }

  &.start {
    right: 95%;
  }
}

.tooltip {
  position: absolute;
  pointer-events: none;
  top: 110%;
  // left: 50%;
  z-index: 2000;
  line-height: 1.1;
  font-size: 1rem;
  width: 200px;
  text-align: center;
  font-weight: 400;
  padding: 15px 10px;
  background: hsla(0, 0%, 0%, 0.8);
  color: var(--bg);
  // transform: translateX(-50%);
  transition: none;

  h3 {
    margin: 0 0 8px 0;
    font-size: 1.4em;
    line-height: 1;
  }

  .sub {
    margin: 5px 0;
  }

  .level {
    // font-weight: bold;
    margin-bottom: 5px;

    .points {
      font-size: 0.85em;
    }
  }
}

.inprogress {
  width: $widthd;
  height: $widthd;
  position: relative;
  background-color: hsla(0, 0%, 92%, 1);
  background-size: 80%;
  box-shadow: none;

  &:hover,
  &:active,
  &.focus {
    box-shadow: none;
  }

  .label {
    font-size: 0.8em;
    color: var(--grayd2);
  }
}

.progress {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotate(90deg);
  transition: stroke-dashoffset 1s;
  stroke-dasharray: 315; // 315 is 100%
  stroke-dashoffset: 315;
  stroke: var(--grayd2);
  mix-blend-mode: multiply;
}
</style>
