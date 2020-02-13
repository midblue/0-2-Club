<template>
  <div
    v-if="achievedAwards.length > 0 || awardsInProgress.length > 0"
  >
    <h2 class="awardslabel">
      Awards
      <!-- {{ achievedAwards.length }} Award{{ achievedAwards.length === 1 ? '' : 's' }} -->
    </h2>
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
// todo awards for:
// consistently attending tournaments x weeks in a row
// attending tournaments in a series
// improving win ratio x% in x weeks
// lifetime total x unique opponents
// x total rivals / rivals beat
// todo awards give points

import Award from '~/components/Awards/Award'
const calculateAwards = require('~/api/data/points/awards').default

export default {
  props: {
    player: {},
  },
  components: { Award },
  data() {
    return {
      hover: null,
    }
  },
  computed: {
    allAwards() {
      return calculateAwards(this.player)
    },
    achievedAwards() {
      return this.allAwards
        .filter(a => a.level > 0)
        .sort((a, b) => b.level - a.level)
    },
    awardsInProgress() {
      return this.allAwards
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
