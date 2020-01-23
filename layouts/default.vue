<template>
  <div>
    <Menu />
    <div class="content">
      <nuxt />
    </div>
    <SiteFooter />
  </div>
</template>

<script>
import Menu from '~/components/Menu'
import SiteFooter from '~/components/SiteFooter'

export default {
  components: { Menu, SiteFooter },
}
</script>

<style lang="scss"></style>
