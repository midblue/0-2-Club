<template>
  <div class="eventslisting">
    <template v-if="events">
      <div>
        <div
          class="panel"
          v-for="event in events"
          :key="event.slug + event.tournamentSlug"
        >
          <h3>
            <span
              v-if="event.points.reduce((t, p) => t + p.value, 0)"
              class="colorpad"
              :style="{ background: `var(--l${level})` }"
            >
              +{{ event.points.reduce((t, p) => t + p.value, 0) }}
            </span>
            {{ event.tournamentName }}
            <span class="sub">
              {{ event.name }} ({{
                new Date(event.date * 1000).toLocaleDateString()
              }})
            </span>
          </h3>
          <div v-if="event.points.length === 0" class="sub">
            Calculating points... Check back in 24 hours!
          </div>
          <div
            v-for="(point, index) in event.points"
            :key="event.slug + event.tournamentSlug + 'point' + index"
            class="point"
            :class="{ padtop: point.title.indexOf('Set') > -1 }"
          >
            <span
              class="pointvalue"
              :style="{
                color: `var(--l${level}d)`,
                opacity: point.value >= 10 ? 1 : point.value / 10,
              }"
              >+{{ point.value }}</span
            >
            <span class="title">{{ point.title }}</span>
            <span class="context sub">
              <span>
                {{
                  point.context.substring(
                    0,
                    point.context.indexOf('%O') ||
                      point.context.length
                  )
                }}
                <nuxt-link
                  v-if="point.opponent"
                  :to="`/g/${game}/i/${point.opponent.id}`"
                  >{{ point.opponent.tag }}</nuxt-link
                >
                {{
                  point.context.substring(
                    point.context.indexOf('%O') + 2 ||
                      point.context.length
                  )
                }}
              </span>
            </span>
          </div>
        </div>
        <div class="sub disclaimer">
          See something wrong? Check back in a day or two — we fully
          update all points on a rotating basis. If something still
          seems wrong a few days later, please send us a screenshot!
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import levels from '~/common/levels'
export default {
  props: {
    events: {},
    level: {},
    game: {},
  },
  data() {
    return {
      levels,
    }
  },
  computed: {},
}
</script>

<style scoped lang="scss">
h3 {
  line-height: 1.1;
  margin-top: 0;
}

.point {
  line-height: 1.05;
  max-width: 600px;
  display: grid;
  grid-template-columns: 20px 200px 1fr;
  grid-gap: 10px;

  &.padtop {
    padding-top: 10px;
  }

  .pointvalue {
    font-weight: bold;
  }
}

.disclaimer {
  text-align: center;
  max-width: 450px;
  margin: 0 auto;
}
</style>
