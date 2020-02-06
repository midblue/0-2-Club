<template>
  <footer>
    <div>
      <div class="sub">
        Made by
        <a href="https://www.jasperstephenson.com/" target="_blank"
          >jasp</a
        >
        in 2020.
      </div>
      <div class="sub">
        <a
          href="mailto:jasperstephenson@gmail.com?subject=Feedback About The 0-2 Club"
          target="_blank"
          >Feedback</a
        >
      </div>
    </div>
  </footer>
</template>

<script>
export default {}
</script>

<style lang="scss" scoped>
footer {
  width: 100%;
  // background: var(--text);
  // color: white;
  text-align: center;

  & > div {
    padding: 0 100px;
    height: 200px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
  }
}

a {
  line-height: 1;
}
</style>
