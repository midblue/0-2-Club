<template>
  <div class="badges">
    <div v-for="badge, index in badges" :key="badge+index" class="placeholder"></div>
  </div>
</template>

<script>
export default {
  props: {
    points: {},
  },
  computed: {
    badges() {
      return [1, 2, 3, 4]
    },
  },
}
</script>

<style lang="scss" scoped>
.badges {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, 40px);
  grid-gap: 10px;
}
.placeholder {
  width: 40px;
  height: 40px;
  background: var(--border);
  border-radius: 50%;
}
</style>
