<template>
  <PlayerView :initialPlayer="player" />
</template>

<script>
import axios from '~/plugins/axios'
import PlayerView from '~/components/PlayerView'

export default {
  scrollToTop: true,
  asyncData({ params, error, redirect, req }) {
    if (req)
      require('~/api/data/scripts/log')('page:tag', 'gray')(
        req.headers['x-forwarded-for']
          ? req.headers['x-forwarded-for'].split(/, /)[0]
          : req.connection.remoteAddress || req.socket.remoteAddress,
        params.game,
        params.tag
      )
    return axios
      .get(`/api/points/${params.game}/tag/${encodeURIComponent(params.tag)}/`)
      .then(res => {
        if (res.data && !res.data.err && !res.data.disambiguation)
          return { player: res.data }
        else if (res.data.disambiguation)
          redirect(`/g/${params.game}/t/${params.tag}/disambiguation`)
        else
          return {
            player: {
              game: params.game,
              tag: params.tag,
              points: [],
              peers: [],
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
          content: `${this.player.tag} | The 0-2 Club`,
        },
        {
          property: 'twitter:title',
          hid: `twitter:title`,
          content: `${this.player.tag} | The 0-2 Club`,
        },
        {
          hid: `og:url`,
          property: 'og:url',
          content: `https://www.0-2.club/${this.player.game}/t/${this.player.tag}/`,
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
