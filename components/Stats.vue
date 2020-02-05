<template>
  <div class="stats">
    <div class="stat" v-if="eventsThisYear > 0">
      <div class="bignumber">{{ eventsThisYear }}</div>
      <div class="sub">Event{{eventsThisYear === 1 ? '' : 's'}} This Year</div>
    </div>

    <div class="stat" v-if="majors > 0">
      <div class="bignumber">{{ majors }}</div>
      <div class="sub">Major{{majors === 1 ? '' : 's'}} Attended</div>
    </div>

    <div class="stat" v-if="bestStreak > 2">
      <div class="bignumber">{{ bestStreak }}</div>
      <div class="sub">Best Win Streak</div>
    </div>

    <!-- <div class="stat">
      <div class="bignumber">{{ totalSets }}</div>
      <div class="sub">Total Matches</div>
    </div>-->

    <div class="stat" v-if="totalTakedowns > 0">
      <div class="bignumber">{{ totalTakedowns }}</div>
      <div class="sub">Total Match Wins</div>
    </div>
  </div>
</template>

<script>
import levels from '~/common/levels'

export default {
  props: {
    player: {},
    points: {},
    level: {},
  },
  data() {
    return {
      levels,
    }
  },
  computed: {
    eventsThisYear() {
      return this.player.participatedInEvents.reduce((total, event) => {
        if (
          new Date(event.date * 1000).getFullYear() === new Date().getFullYear()
        )
          return total + 1
        return total
      }, 0)
    },
    totalSets() {
      return this.player.participatedInEvents.reduce((total, event) => {
        return total + event.matchesWithUser.length
      }, 0)
    },
    totalTakedowns() {
      return this.player.participatedInEvents.reduce((total, event) => {
        return (
          total +
          event.matchesWithUser.reduce((total, match) => {
            if (match.winnerId === this.player.id) return total + 1
            return total
          }, 0)
        )
      }, 0)
    },
    bestStreak() {
      return (this.points || []).reduce((highest, point) => {
        if (point.context.indexOf('wins in a row') > -1) {
          const wins = parseInt(
            point.context.substring(0, point.context.indexOf(' '))
          )
          if (wins > highest) return wins
        }
        return highest
      }, 0)
    },
    majors() {
      return this.player.participatedInEvents.reduce((total, event) => {
        return total + event.totalParticipants > 200 ? 1 : 0
      }, 0)
    },
  },
}
</script>

<style scoped lang="scss">
.stats {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  grid-gap: 0px;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 1px solid var(--bg);
    z-index: 3;
  }

  .stat {
    position: relative;
    z-index: 2;
    padding: 12px 10px 8px 10px;
    background: var(--bg);
    height: 100%;
    width: 100%;
    display: flex;
    align-items: center;
    flex-direction: column;
    justify-content: center;
    border: 0.5px solid var(--gray);
  }

  .bignumber {
    font-weight: 700;
    font-size: 1.7em;
    line-height: 1;
  }
}
</style>
