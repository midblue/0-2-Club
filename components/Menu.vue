<template>
  <nav>
    <nuxt-link to="/"
      ><img class="logo" src="~/assets/img/logo.svg" alt="The 0-2 Club logo"
    /></nuxt-link>
  </nav>
</template>

<script>
export default {}
</script>

<style lang="scss" scoped>
nav {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 100%;
  overflow: hidden;
  background: white;
  border-bottom: 1px solid var(--border);
  height: 50px;
  padding: 0 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.logo {
  max-width: 200px;
}

a {
  line-height: 1;
}
</style>
