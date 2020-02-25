<template>
  <PlayerView :initialPlayer="player" />
</template>

<script>
import axios from '~/plugins/axios'
import PlayerView from '~/components/PlayerView'

export default {
  scrollToTop: true,
  asyncData({ params, error, redirect, req }) {
    return axios.get(`/api/points/${params.game}/id/${params.id}`).then(res => {
      if (res.data && !res.data.err && !res.data.disambiguation) {
        if (req)
          require('~/api/data/scripts/log')('page:id', 'gray')(
            req.connection.remoteAddress || req.socket.remoteAddress,
            params.game,
            params.id,
            res.data.tag
          )
        return { player: res.data }
      } else
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
    return {
      title: this.player.tag,
      meta: [
        {
          property: 'og:title',
          hid: `og:title`,
          content: `${
            this.player.tag ? this.player.tag + ' | ' : ''
          }The 0-2 Club`,
        },
        {
          property: 'twitter:title',
          hid: `twitter:title`,
          content: `${
            this.player.tag ? this.player.tag + ' | ' : ''
          }The 0-2 Club`,
        },
        {
          hid: `og:url`,
          property: 'og:url',
          content: `https://www.0-2.club/${this.player.game}/i/${this.player.id}/`,
        },
      ],
    }
  },
  data() {
    return {}
  },
}
</script>

<style scoped lang="scss"></style>
