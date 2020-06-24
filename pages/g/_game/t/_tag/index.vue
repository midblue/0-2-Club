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
    let ipInfo
    if (req) {
      ipInfo = parseIp(req)
      if (ipInfo.log)
        require('~/api/scripts/log')('page:tag', 'gray')(
          ipInfo.name || ipInfo.ip,
          params.game,
          params.tag
        )
      if (!ipInfo.allowed)
        return error({ statusCode: 404, message: 'Not found.' })
    }
    return axios
      .get(
        ipInfo
          ? `/api/points/${params.game}/tag/${encodeURIComponent(
              params.tag
            )}/`
          : `/api/points/${params.game}/tag/${encodeURIComponent(
              params.tag
            )}/active`
      )
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
    if (!this.player.id) return {}
    const data = {
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
          content: `http://www.0-2.club/${encodeURIComponent(
            this.player.game
          )}/t/${encodeURIComponent(this.player.tag)}/`,
        },
        {
          property: 'og:description',
          hid: `og:description`,
          content: `Level ${this.level.level}: ${this.level.label} in ${this.player.game}`,
        },
      ],
    }
    if (this.player.img)
      data.meta.push({
        hid: `og:image`,
        property: 'og:image',
        content: this.player.img,
      })
    return data
  },
  data() {
    return {}
  },
  computed: {
    level() {
      return this.$store.state.player.level || {}
    },
  },
}
</script>

<style scoped lang="scss"></style>
