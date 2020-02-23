<template>
  <div v-if="achievedAwards.length > 0 || awardsInProgress.length > 0">
    <h2 class="awardslabel">Awards</h2>
    <div class="awards">
      <Award
        v-for="(award, index) in achievedAwards"
        :key="'award' + index"
        @isHovering="hover = index"
        @unhover="hover = null"
        :award="award"
        :fade="hover !== null && hover !== index"
      />

      <div
        class="divider"
        v-if="
          achievedAwards.length > 0 && awardsInProgress.length > 0
        "
      ></div>

      <Award
        v-for="(award, index) in awardsInProgress"
        :key="'awardinprogress' + index"
        @isHovering="hover = index + 'inProgress'"
        @unhover="hover = null"
        :award="award"
        :hover="hover !== null && hover !== index + 'inProgress'"
      />
    </div>
  </div>
</template>

<script>
import Award from '~/components/Awards/Award'

export default {
  props: {
    awards: {},
  },
  components: { Award },
  data() {
    return {
      hover: null,
    }
  },
  computed: {
    achievedAwards() {
      return this.awards
        .filter(a => a.level > 0)
        .sort((a, b) => b.level - a.level)
    },
    awardsInProgress() {
      return this.awards
        .filter(a => a.level === 0)
        .sort((a, b) => b.progress - a.progress)
    },
  },
}
</script>

<style lang="scss" scoped>
.awardslabel {
  margin: 0.2em 0 0 0;
}

.awards {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, 60px);
  grid-gap: 0px;
}

.divider {
  height: 70%;
  margin: 15% 0;
  width: 55%;
  border-right: 1px solid var(--grayd);
  display: flex;
  align-items: center;
  padding: 0 0 0 10px;
}
</style>
