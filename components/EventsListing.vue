<template>
  <div class="eventslisting">
    <template v-if="events">
      <div>
        <EventListing
          v-for="event in events"
          :key="event.eventSlug + event.tournamentSlug"
          :event="event"
          :level="level"
          :game="game"
        />
        <div class="sub disclaimer">
          <b>See something wrong?</b> Check back in a day or two — we
          fully update all points on a rotating basis. If something
          still seems wrong a few days later, please send us a
          screenshot!
        </div>
        <div class="sub disclaimer">
          <b>Something missing?</b> Feel free to add events by
          smash.gg url above!
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import EventListing from '~/components/EventListing'

export default {
  components: { EventListing },
  props: {},
  data() {
    return {}
  },
  computed: {
    events() {
      return this.$store.state.player.participatedInEvents
    },
    level() {
      return this.$store.state.player.level.level
    },
    game() {
      return this.$store.state.player.game
    },
  },
}
</script>

<style scoped lang="scss">
.disclaimer {
  text-align: center;
  max-width: 450px;
  margin: 0 auto;
}
</style>
