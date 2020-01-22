<template>
  <PlayerView
    :initialPlayer="player"
    :initialPoints="points"
    :initialPeers="peers"
  />
</template>

<script>
import axios from '~/plugins/axios'
import PlayerView from '~/components/PlayerView'

export default {
  asyncData({ params, error, redirect }) {
    return axios
      .get(`/api/points/${params.game}/tag/${encodeURIComponent(params.tag)}/`)
      .then(res => {
        if (res.data && !res.data.err && !res.data.disambiguation)
          return res.data
        else if (res.data.disambiguation)
          redirect(`/g/${params.game}/t/${params.tag}/disambiguation`)
        else
          return {
            player: {
              game: params.game,
              tag: params.tag,
            },
            points: [],
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
