<template>
  <div class="panel" :class="{ open }" @click="open ? null : (open = !open)">
    <h3 :class="{ open }" @click.stop="open = !open">
      <span
        v-if="totalPoints"
        class="colorpad points"
        :style="{
          background: `var(--l${displayColorLevel})`,
          opacity: displayOpacity,
        }"
        ><span>+{{ totalPoints }}</span></span
      >
      <span class="title">
        <span class="tournamentname">{{
          event.tournamentName.replace(/ fe?a?tu?r?i?n?g?\.? .*/gi, '')
        }}</span>
        <br v-if="open" />
        <span class="sub eventname">
          {{ event.name.replace(/ fe?a?tu?r?i?n?g?\.? .*/gi, '') }}
          ({{ new Date(event.date * 1000).toLocaleDateString() }})
        </span>
      </span>
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

// todo add dropdown arrow for closed/open

export default {
  props: {
    openByDefault: { default: false },
    event: {},
    level: {},
    game: {},
  },
  data() {
    return {
      open: this.openByDefault,
    }
  },
  computed: {
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
      return 1
    },
  },
}
</script>

<style scoped lang="scss">
.panel {
  &:not(.open) {
    padding-top: 1.5em;
    padding-bottom: 1.5em;
    cursor: pointer;
  }
}

h3 {
  line-height: 1;
  margin-top: 0;
  cursor: pointer;
  display: flex;

  &:not(.open) {
    font-size: 1.2em;
    margin-bottom: 0;
  }

  .points {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0.5em;
    padding: 0.15em 0.35em;
    position: relative;
    top: -0.1em;

    span {
      position: relative;
      top: 0.05em;
    }
  }

  .title {
    line-height: 1.1;
    flex: 1;

    .tournamentname {
      font-size: 1.2em;
    }
  }

  &.open {
    .points {
      padding: 0.15em 0.5em;
    }
  }
}

.point {
  line-height: 1.4;
  max-width: 600px;
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
  }
}

.context {
  opacity: 1;
  color: var(--textl);

  a {
    color: inherit;
  }
}
</style>
