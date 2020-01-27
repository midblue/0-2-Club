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
}
</script>

<style lang="scss"></style>
