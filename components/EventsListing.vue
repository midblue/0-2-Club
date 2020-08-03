<template>
  <div class="eventslisting">
    <template v-if="displayEvents.length">
      <div>
        <EventListing
          v-for="(event, index) in displayEvents"
          :key="event.eventSlug + event.tournamentSlug"
          :event="event"
          :maxPoints="maxPoints"
          :level="level"
          :game="game"
          :openByDefault="index === 0"
        />
        <div class="sub disclaimer">
          <b>See something wrong?</b> Check back in a day or two — we fully
          update all points on a rotating basis. If something still seems wrong
          a few days later, please send us a screenshot!
        </div>
        <div class="sub disclaimer">
          <b>Something missing?</b> Feel free to add events by smash.gg url
          above!
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import EventListing from '~/components/EventListing'
// todo link to event page on smash.gg in title

export default {
  components: { EventListing },
  props: {
    events: {},
  },
  data() {
    return {}
  },
  computed: {
    displayEvents() {
      if (!this.events) return []
      return [...this.events].sort((a, b) => b.date - a.date)
    },
    level() {
      return this.$store.state.player.level.level
    },
    game() {
      return this.$store.state.player.game
    },
    maxPoints() {
      return this.displayEvents.reduce((highest, e) => {
        const total = (e.points || []).reduce((t, p) => t + p.value, 0)
        return Math.max(total, highest)
      }, 0)
    },
  },
}
</script>

<style scoped lang="scss">
.disclaimer {
  color: white;
  text-align: center;
  max-width: 450px;
  margin: 0 auto;
}
</style>
