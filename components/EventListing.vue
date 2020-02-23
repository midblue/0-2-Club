<template>
  <div class="panel" :class="{open}">
    <h3 :class="{open}">
      <span
        v-if="event.points.reduce((t, p) => t + p.value, 0)"
        class="colorpad"
        :style="{ background: `var(--l${level})` }"
      >+{{ event.points.reduce((t, p) => t + p.value, 0) }}</span>
      {{ event.tournamentName }}
      <span class="sub">
        {{ event.name }} ({{
        new Date(event.date * 1000).toLocaleDateString()
        }})
      </span>
    </h3>
    <template v-if="open">
      <div
        v-if="event.points.length === 0"
        class="sub"
      >Calculating points... Check back in 24 hours!</div>
      <div
        v-for="(point, index) in event.points"
        :key="event.eventSlug + event.tournamentSlug + 'point' + index"
        class="point"
        :class="{ padtop: point.title.indexOf('Set') > -1 }"
      >
        <span
          class="pointvalue"
          :style="{
                color: `var(--l${level}d)`,
                opacity: point.value >= 10 ? 1 : point.value / 10,
              }"
        >+{{ point.value }}</span>
        <div class="explanation">
          <span class="title">{{ point.title }}</span>
          <span class="context sub">
            <span>
              {{
              point.context.substring(
              0,
              point.context.indexOf('%O') > -1
              ? point.context.indexOf('%O')
              : point.context.length
              )
              }}
              <nuxt-link v-if="point.opponent" :to="`/g/${game}/i/${point.opponent.id}`">
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
              >{{ point.opponent.tag }}</nuxt-link>
              {{
              point.context.substring(
              point.context.indexOf('%O') > -1
              ? point.context.indexOf('%O') + 2
              : point.context.length
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
export default {
  props: {
    event: {},
    level: {},
    game: {},
  },
  data() {
    return {
      open: true,
    }
  },
  computed: {},
}
</script>

<style scoped lang="scss">
.panel {
  // cursor: pointer;

  &:not(.open) {
    padding-top: 1.5em;
    padding-bottom: 1.5em;
  }
}

h3 {
  line-height: 1.1;
  margin-top: 0;

  &:not(.open) {
    font-size: 1.2em;
    margin-bottom: 0;
  }
}

.point {
  line-height: 1.05;
  max-width: 600px;
  display: grid;
  grid-template-columns: 20px 1fr;
  grid-gap: 10px;

  &.padtop {
    padding-top: 15px;

    @media (max-width: 768px) {
      line-height: 1;
      padding-top: 15px;
    }
  }

  .explanation {
    display: grid;
    grid-template-columns: 200px 1fr;

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