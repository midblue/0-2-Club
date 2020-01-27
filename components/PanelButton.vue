<template>
  <div class="combo buttonbox">
    <div class="box mainpanel">
      <slot></slot>
    </div>
    <div class="bigbutton">
      <slot name="button"></slot>
    </div>
  </div>
</template>

<script>
export default {}
</script>

<style lang="scss" scoped>
.combo {
  position: relative;
  display: grid;
  grid-template-columns: 70% 30%;
  margin: 50px 0;
  width: 100%;
}
.mainpanel {
  width: 100%;
  height: 100%;
  margin: 0;
}
.bigbutton {
  position: relative;
  height: 100%;

  & > *,
  & > * > * {
    position: relative;
    display: block;
    margin: 0;
    width: 100%;
    height: 100%;
  }
}
</style>
