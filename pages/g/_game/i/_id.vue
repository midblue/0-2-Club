<template>
  <PlayerView :initialPlayer="player" :key="'id' + player.id" />
</template>

<script>
import axios from '~/plugins/axios'
import PlayerView from '~/components/PlayerView'
const { parseIp } = require('~/common/functions')
import levels from '~/common/levels'

export default {
  scrollToTop: true,
  asyncData({ params, error, redirect, req }) {
    let ipInfo
    if (req) {
      ipInfo = parseIp(req)
      // console.log('ip info:', ipInfo)
      if (!ipInfo.allowed) {
        if (ipInfo.log)
          require('~/server/scripts/log')('page:id', 'gray')(
            ipInfo.name || ipInfo.ip,
            params.game,
            params.id,
          )
        return error({ statusCode: 404, message: 'Not found.' })
      }
    }
    return axios
      .get(
        ipInfo
          ? `/api/player/${params.game}/id/${params.id}`
          : `/api/player/${params.game}/id/${params.id}/active`,
      )
      .then(res => {
        if (res.data.redirect)
          return redirect(`/g/${params.game}/i/${res.data.redirect}`)
        if (res.data && !res.data.err && !res.data.disambiguation) {
          if (req && ipInfo.log)
            require('~/server/scripts/log')('page:id', 'gray')(
              ipInfo.name || ipInfo.ip,
              params.game,
              params.id,
              res.data.tag,
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
    if (!this.player.tag) return {}
    const data = {
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
          content: `http://www.0-2.club/${encodeURIComponent(
            this.player.game,
          )}/i/${this.player.id}/`,
        },
      ],
    }
    if (this.level)
      data.meta.push({
        property: 'og:description',
        hid: `og:description`,
        content: `Level ${this.level.level}: ${this.level.label} in ${this.player.game}`,
      })
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
      return this.$store.state.player.level
    },
  },
}
</script>

<style scoped lang="scss"></style>
