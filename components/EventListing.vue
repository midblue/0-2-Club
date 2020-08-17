<template>
  <div
    class="panel"
    :class="{ open }"
    @click="open ? null : (open = !open)"
    @mouseover="hover = true"
    @mouseout="hover = false"
  >
    <h3 :class="{ open, fullheader: open }" @click.stop="open = !open">
      <div v-if="totalPoints" class="colorpad points">
        <div
          class="bg"
          :style="{
            background: `var(--l${displayColorLevel})`,
            opacity: displayOpacity,
          }"
        ></div>
        <span>+{{ totalPoints }}</span>
      </div>
      <div class="title">
        <span class="tournamentname">{{
          event.tournamentName.replace(/ fe?a?tu?r?i?n?g?\.? .*/gi, '')
        }}</span>
        <br v-if="open || isMobile" />
        <span class="sub eventname">
          {{ event.name.replace(/ fe?a?tu?r?i?n?g?\.? .*/gi, '') }}
          ({{ new Date(event.date * 1000).toLocaleDateString() }})
        </span>
      </div>
      <div v-if="!open" :class="{ hover }" class="downcaret">
        <span>˅</span>
      </div>
    </h3>
    <template v-if="open">
      <div
        v-for="(point, index) in event.points"
        :key="event.eventSlug + event.tournamentSlug + 'point' + index"
        class="point"
        :class="{ padtop: point.title.indexOf('Set') > -1 }"
      >
        <span
          class="pointvalue"
          :style="{
            color: `var(--l${displayColorLevel}d)`,
            opacity: point.value >= 8 ? 1 : point.value / 10 + 0.2,
          }"
          >+{{ point.value }}</span
        >
        <div class="explanation">
          <span class="title">{{ point.title }}</span>
          <span class="context sub">
            <span>
              {{
                point.context.substring(
                  0,
                  point.context.indexOf('%O') > -1
                    ? point.context.indexOf('%O')
                    : point.context.length,
                )
              }}
              <nuxt-link
                v-if="point.opponent"
                :to="`/g/${game}/i/${point.opponent.id}`"
              >
                <div
                  v-if="point.opponent.img"
                  :style="{
                    'background-image': `url('${point.opponent.img}')`,
                  }"
                  class="playericon"
                ></div>
              </nuxt-link>
              <nuxt-link
                v-if="point.opponent"
                :to="`/g/${game}/i/${point.opponent.id}`"
                >{{ point.opponent.tag }}</nuxt-link
              >
              {{
                point.context.substring(
                  point.context.indexOf('%O') > -1
                    ? point.context.indexOf('%O') + 2
                    : point.context.length,
                )
              }}
            </span>
          </span>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import levels from '~/common/levels'

export default {
  props: {
    openByDefault: { default: false },
    event: {},
    level: {},
    game: {},
    maxPoints: {},
  },
  data() {
    return {
      open: this.openByDefault,
      hover: false,
    }
  },
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },
    totalPoints() {
      return (this.event.points || []).reduce((t, p) => t + p.value, 0)
    },
    displayColorLevel() {
      return this.level
      // const eventAdjustedPoints = this.totalPoints * 50
      // let l = 0
      // while (eventAdjustedPoints > levels[l].points) l++
      // if (l > 0) l--
      // return l
    },
    displayOpacity() {
      return (this.totalPoints / this.maxPoints) * 0.9 + 0.1
    },
  },
}
</script>

<style scoped lang="scss">
.panel {
  position: relative;

  &:not(.open) {
    padding-top: 0;
    padding-bottom: 0;
    padding-right: 0;
    padding-left: 0;
    cursor: pointer;
  }
}

h3 {
  position: relative;
  line-height: 1;
  margin-top: 0;
  cursor: pointer;
  display: flex;
  align-items: stretch;
  margin-bottom: 0.7em !important;

  &:not(.open) {
    font-size: 1.2em;
    margin-bottom: 0 !important;
    align-items: stretch;

    .title {
      padding-top: 1em;
      padding-bottom: 1em;
    }

    .points {
      width: 8%;
      min-width: 50px;
      border-radius: 0;
      font-size: 1em;
    }
  }

  .downcaret {
    opacity: 0.2;
    display: flex;
    width: 10%;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    span {
      position: relative;
      top: 5%;
      transform: scaleX(1.5);
    }

    &.hover {
      opacity: 0.8;
    }
  }

  .points {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 2.5%;
    position: relative;
    font-size: 1.2em;
    width: 15%;
    min-width: 80px;
    top: 0;
    border-bottom-right-radius: var(--radius);
    overflow: hidden;

    .bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }

    span {
      position: relative;
      top: 0.05em;
    }
  }

  .title {
    display: block;
    line-height: 1.1;
    flex: 1;
    padding: 0.7em 0;

    .tournamentname {
      font-size: 1.2em;
    }
  }

  &.open {
    .points {
      padding: 0.7em 0.7em;
    }
  }
}

.point {
  line-height: 1.4;
  max-width: 575px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: 20px 1fr;
  grid-gap: 10px;

  &.padtop {
    padding-top: 8px;
    margin-top: 5px;
    border-top: 1px dashed var(--grayd);

    @media (max-width: 768px) {
      border-top: 1px dashed var(--grayd);
    }
  }

  .explanation {
    display: grid;
    grid-template-columns: 200px 1fr;
    line-height: 1.1;
    margin-top: 2px;

    @media (max-width: 768px) {
      margin-bottom: 4px;
      display: block;
    }
  }

  .pointvalue {
    font-weight: bold;
    text-align: center;
  }
}

.context {
  color: var(--textl);

  a {
    color: inherit;
  }
}
</style>
