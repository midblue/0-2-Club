<template>
  <div>
    <Menu />
    <Notifications />
    <div class="content">
      <nuxt />
    </div>
    <SiteFooter />
  </div>
</template>

<script>
import Menu from '~/components/Menu'
import Notifications from '~/components/Notifications'
import SiteFooter from '~/components/SiteFooter'

export default {
  components: { Menu, Notifications, SiteFooter },
  computed: {
    isMobile() {
      return this.$store.state.isMobile
    },
  },
  mounted() {
    window.dataLayer = window.dataLayer || []
    function gtag() {
      dataLayer.push(arguments)
    }
    gtag('js', new Date())
    gtag('config', 'G-4QVMMRTV5R')

    this.checkWidth()
    window.addEventListener('resize', this.checkWidth)
  },
  methods: {
    checkWidth() {
      if (!this.isMobile && window.outerWidth <= 768)
        this.$store.commit('setIsMobile', true)
      else if (this.isMobile && window.outerWidth > 768)
        this.$store.commit('setIsMobile', false)
    },
  },
}
</script>

<style lang="scss"></style>
