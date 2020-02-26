<template>
  <PlayerView :initialPlayer="player" />
</template>

<script>
import axios from '~/plugins/axios'
import PlayerView from '~/components/PlayerView'
const { parseIp } = require('~/common/functions').default

export default {
  scrollToTop: true,
  asyncData({ params, error, redirect, req }) {
    if (req) {
      const ipInfo = parseIp(req)
      require('~/api/scripts/log')('page:tag', 'gray')(
        ipInfo.name || ipInfo.ip,
        params.game,
        params.tag
      )
      if (!ipInfo.allowed)
        return error({ statusCode: 404, message: 'Not found.' })
    }
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
