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
  color: var(--text);
  position: relative;
  display: grid;
  grid-template-columns: 70% 30%;
  margin: 50px 0;
  width: 100%;
  max-width: 100%;
  border-radius: var(--radius);
  overflow: hidden;

  @media (max-width: 768px) {
    display: block;
    margin: 40px 0;
  }
}
.mainpanel {
  position: relative;
  width: 100%;
  height: 100%;
  margin: 0;
  max-width: 100%;
  border-radius: var(--radius);
  overflow: hidden;
}
.bigbutton {
  position: relative;
  height: 100%;
  max-width: 100%;

  & > *,
  & > * > * {
    border-radius: 0;
    position: relative;
    display: block;
    margin: 0;
    width: 100%;
    height: 100%;
  }
}
</style>
