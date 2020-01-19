<template>
  <section>
    <h1>{{ player.tag }}</h1>
    <div>
      <div
        v-for="event in player.participatedInEvents"
        :key="event.slug + event.tournamentSlug"
      >
        <h3>{{ event.tournamentName }}</h3>
        <div>{{ event.name }}</div>
      </div>
    </div>
  </section>
</template>

<script>
import axios from '~/plugins/axios'

export default {
  asyncData({ params, error }) {
    return axios
      .get(`/api/points/${params.game}/${params.tag}/`)
      .then(res => {
        return res.data
      })
      .catch(e => {
        error({ statusCode: 404, message: 'User not found' })
      })
  },
  head() {
    return {}
  },
}
</script>

<style scoped></style>
