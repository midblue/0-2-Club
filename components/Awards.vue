<template>
  <div class="badges">
    <div v-for="badge, index in badges" :key="badge+index" class="placeholder"></div>
  </div>
</template>

<script>
// todo awards for:
// consistently attending tournaments x weeks in a row
// improving win ratio x% in x weeks
// lifetime total x unique opponents
// x total rivals
// todo awards give points
// todo awards show progress to next level
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
  grid-template-columns: repeat(auto-fit, 80px);
  grid-gap: 10px;
}
.placeholder {
  width: 80px;
  height: 80px;
  background: var(--grayd);
  border-radius: 50%;
}
</style>
