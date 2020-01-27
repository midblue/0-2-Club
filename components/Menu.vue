<template>
  <nav>
    <div class="left">
      <nuxt-link to="/">
        <img class="logo" src="~/assets/img/logo.svg" alt="The 0-2 Club logo" />
      </nuxt-link>
    </div>
    <div class="right">
      <a
        class="feedback"
        href="mailto:jasperstephenson@gmail.com?subject=Feedback About The 0-2 Club"
        target="_blank"
      >
        <button class="low">Give Feedback</button>
      </a>
    </div>
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

  @media (max-width: 768px) {
    height: 40px;
  }
}

.right,
.left {
  display: flex;
  align-items: center;
}

.logo {
  max-width: 200px;

  @media (max-width: 768px) {
    max-width: 170px;
  }
}

a {
  line-height: 1;
}
</style>
