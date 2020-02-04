<template>
  <PlayerView :initialPlayer="player" />
</template>

<script>
import axios from '~/plugins/axios'
import PlayerView from '~/components/PlayerView'

export default {
  scrollToTop: true,
  asyncData({ params, error, redirect }) {
    return axios.get(`/api/points/${params.game}/id/${params.id}`).then(res => {
      if (res.data && !res.data.err && !res.data.disambiguation)
        return { player: res.data }
      else
        return {
          player: {
            game: params.game,
            peers: [],
            points: [],
            id: params.id,
          },
        }
    })
  },
  components: { PlayerView },
  head() {
    return {}
  },
  data() {
    return {}
  },
}
</script>

<style scoped lang="scss"></style>
