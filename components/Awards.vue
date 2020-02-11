<template>
  <div v-if="awards.length > 0 || awardsInProgress.length > 0">
    <h2 class="awardslabel">
      Awards
      <!-- {{ awards.length }} Award{{ awards.length === 1 ? '' : 's' }} -->
    </h2>
    <div class="awards">
      <button
        v-for="(award, index) in awards"
        :key="'award' + index"
        class="award"
        :class="
          award.type +
            ' ' +
            (hover === index ? 'focus' : '') +
            ' ' +
            (hover !== null && hover !== index ? 'fade' : '')
        "
        :style="{ 'background-color': `var(--l${award.level})` }"
        @mouseover="hover = index"
        @focus="hover = index"
        @mouseout="hover = null"
        @blur="hover = null"
      >
        <div class="label">{{ award.label }}</div>
        <transition name="fade">
          <div class="tooltip" v-if="hover === index">
            <h3 v-html="award.title"></h3>
            <div
              class="level"
              :style="{ color: `var(--l${award.level})` }"
            >
              Level {{ award.level }}
            </div>
            <div v-html="award.description"></div>
          </div>
        </transition>
      </button>

      <div
        class="divider"
        v-if="awards.length > 0 && awardsInProgress.length > 0"
      ></div>

      <button
        v-for="(award, index) in awardsInProgress"
        :key="'awardinprogress' + index"
        class="award inprogress"
        :class="
          award.type +
            ' ' +
            (hover === index + 'inProgress' ? 'focus' : '') +
            ' ' +
            (hover !== null && hover !== index + 'inProgress'
              ? 'fade'
              : '')
        "
        @mouseover="hover = index + 'inProgress'"
        @focus="hover = index + 'inProgress'"
        @mouseout="hover = null"
        @blur="hover = null"
      >
        <svg
          class="progress"
          width="106px"
          height="106px"
          viewBox="0 0 106 106"
        >
          <g fill="none">
            <circle
              stroke-width="5"
              :stroke-dashoffset="315 - 315 * award.progress"
              cx="53"
              cy="53"
              r="50"
            ></circle>
          </g>
        </svg>
        <transition name="fade">
          <div class="tooltip" v-if="hover === index + 'inProgress'">
            <h3>{{ award.title }}</h3>
            <div class="sub">(Not yet achieved)</div>
            <div v-html="award.requirement"></div>
            <div class="sub" v-html="award.bestAttempt"></div>
          </div>
        </transition>
      </button>
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
// todo awards show progress to next level

const { getPlacingRatio } = require('../common/f').default

export default {
  props: {
    player: {},
  },
  data() {
    return {
      hover: null,
    }
  },
  computed: {
    awards() {
      const toShow = []
      toShow.push(
        ...this.yearlyImprovement,
        ...this.mostInOneWeek.filter(a => !a.inProgress),
        ...this.mostWeeksInARow.filter(a => !a.inProgress),
        ...this.bestStreak.filter(a => !a.inProgress),
        ...this.totalGameWins.filter(a => !a.inProgress)
      )
      return toShow
    },
    awardsInProgress() {
      return [
        ...this.mostInOneWeek.filter(a => a.inProgress),
        ...this.mostWeeksInARow.filter(a => a.inProgress),
        ...this.bestStreak.filter(a => a.inProgress),
        ...this.totalGameWins.filter(a => a.inProgress),
      ]
    },
    sortedEvents() {
      return (this.player.participatedInEvents || []).sort(
        (a, b) => a.date - b.date
      )
    },
    // won tournaments
    bestStreak() {
      const bestStreak = (this.player.points || []).reduce(
        (highest, point) => {
          if (point.context.indexOf('wins in a row') > -1) {
            const wins = parseInt(
              point.context.substring(0, point.context.indexOf(' '))
            )
            if (wins > highest.total)
              return {
                total: wins,
                date: point.date,
                name: point.tournamentName,
              }
          }
          return highest
        },
        { total: 0 }
      )
      const firstLevel = 3
      const level = Math.round(
        (bestStreak.total - firstLevel + 1) / 1.5
      )
      if (bestStreak.total > 1)
        return [
          {
            inProgress:
              this.sortedEvents.length &&
              bestStreak.total < firstLevel,
            type: 'streak',
            // label: bestStreak.total,
            title: `Streakin'`,
            description: `Won <span style="font-weight: bold; color:var(--l${level});">${
              bestStreak.total
            }</span> set${
              bestStreak.total === 1 ? '' : 's'
            } in a row at ${bestStreak.name} on ${new Date(
              bestStreak.date * 1000
            ).toLocaleDateString()}`,
            requirement: `Win at least <b>${firstLevel}</b> consecutive sets`,
            bestAttempt: `Best: ${bestStreak.total} on ${new Date(
              bestStreak.start * 1000
            ).toLocaleDateString()}`,
            level,
            progress: bestStreak.total / firstLevel,
          },
        ]
      return []
    },
    totalGameWins() {
      const totalGameWins = this.player.participatedInEvents.reduce(
        (total, event) => {
          return (
            total +
            event.matchesWithUser.reduce((total, match) => {
              if (match.winnerId === this.player.id)
                return total + (match.winnerScore || 0)
              else return total + (match.loserScore || 0)
              return total
            }, 0)
          )
        },
        0
      )
      const firstLevel = 50
      const level = Math.round((totalGameWins - firstLevel + 1) / 100)
      if (totalGameWins > 1)
        return [
          {
            inProgress: totalGameWins < firstLevel,
            type: 'totalwins',
            title: `Winning!`,
            description: `Won <span style="font-weight: bold; color:var(--l${level});">${totalGameWins}</span> total game${
              totalGameWins === 1 ? '' : 's'
            }`,
            requirement: `Win at least <b>${firstLevel}</b> total games`,
            bestAttempt: `Best: ${totalGameWins}`,
            level,
            progress: totalGameWins / firstLevel,
          },
        ]
      return []
    },
    mostWeeksInARow() {
      const aWeek = 9 * 24 * 60 * 60 // give a little leeway for daily rescheduling
      const mostWeeksInARow = this.sortedEvents.reduce(
        (max, event, index) => {
          const start = event.date
          let end = event.date
          let currentEventIndex = index,
            currentEvent = this.sortedEvents[currentEventIndex]

          while (currentEvent && currentEvent.date - end < aWeek) {
            end = currentEvent.date
            currentEventIndex++
            currentEvent = this.sortedEvents[currentEventIndex]
          }
          const totalWeeksInARow = Math.ceil((end - start) / aWeek)
          if (max.total > totalWeeksInARow) return max
          return {
            total: totalWeeksInARow,
            start,
          }
        },
        0
      )
      const awards = []
      const firstLevel = 3
      const level = mostWeeksInARow.total - firstLevel + 1
      if (mostWeeksInARow.total > 1)
        awards.push({
          inProgress:
            this.sortedEvents.length &&
            mostWeeksInARow.total < firstLevel,
          type: 'weeksinarow',
          // label: mostWeeksInARow.total,
          title: `Weekly Warrior`,
          description: `Attended events <span style="font-weight: bold; color:var(--l${level});">${
            mostWeeksInARow.total
          }</span> week${
            mostWeeksInARow.total === 1 ? '' : 's'
          } in a row, starting on ${new Date(
            mostWeeksInARow.start * 1000
          ).toLocaleDateString()}`,
          requirement: `Attend an event for at least <b>${firstLevel}</b> consecutive weeks`,
          bestAttempt: `Best: ${mostWeeksInARow.total} on ${new Date(
            mostWeeksInARow.start * 1000
          ).toLocaleDateString()}`,
          level,
          progress: mostWeeksInARow.total / firstLevel,
        })
      return awards
    },
    mostInOneWeek() {
      const aWeek = 7 * 24 * 60 * 60
      const mostInOneWeek = this.sortedEvents.reduce(
        (max, event, index) => {
          const start = event.date
          let currentEventIndex = index,
            totalEventsInAWeek = 0,
            currentEvent = this.sortedEvents[currentEventIndex]

          while (currentEvent && currentEvent.date - start < aWeek) {
            totalEventsInAWeek++
            currentEventIndex++
            currentEvent = this.sortedEvents[currentEventIndex]
          }
          if (max.total > totalEventsInAWeek) return max
          return {
            total: totalEventsInAWeek,
            start,
          }
        },
        0
      )
      const awards = []
      const firstLevel = 3
      const level = mostInOneWeek.total - firstLevel + 1
      if (mostInOneWeek > 1)
        awards.push({
          inProgress:
            this.sortedEvents.length &&
            mostInOneWeek.total < firstLevel,
          type: 'oneweek',
          // label: mostInOneWeek.total,
          title: `Training Mode`,
          description: `Attended <span style="font-weight: bold; color:var(--l${level});">${
            mostInOneWeek.total
          }</span> event${
            mostInOneWeek.total === 1 ? '' : 's'
          } in one week, starting on ${new Date(
            mostInOneWeek.start * 1000
          ).toLocaleDateString()}`,
          requirement: `Attend at least <b>${firstLevel}</b> events in one week`,
          bestAttempt: `Best: <b>${
            mostInOneWeek.total
          }</b> on ${new Date(
            mostInOneWeek.start * 1000
          ).toLocaleDateString()}`,
          level,
          progress: mostInOneWeek.total / firstLevel,
        })
      return awards
    },
    yearlyImprovement() {
      const eventsUntilThisPoint = []
      const cumulativePlacingRatiosByYear = {}
      for (let event of this.sortedEvents) {
        eventsUntilThisPoint.push(event)
        const placingRatio = getPlacingRatio(eventsUntilThisPoint)
        const eventDate = new Date(event.date * 1000)
        const year = eventDate.getFullYear()
        const month = eventDate.getMonth()
        if (!cumulativePlacingRatiosByYear[year]) {
          // skip if there's not enough time left in the year & this is the first event (October)
          if (month > 9) continue
          cumulativePlacingRatiosByYear[year] = {
            start: placingRatio,
            end: placingRatio,
          }
        } else cumulativePlacingRatiosByYear[year].end = placingRatio
      }

      Object.keys(cumulativePlacingRatiosByYear).forEach(year => {
        cumulativePlacingRatiosByYear[year].improvement =
          cumulativePlacingRatiosByYear[year].start -
          cumulativePlacingRatiosByYear[year].end
      })

      const improvementAwardCutoff = 0.05
      const yearAwards = Object.keys(cumulativePlacingRatiosByYear)
        .map(year => {
          const level = Math.ceil(
            (cumulativePlacingRatiosByYear[year].improvement -
              improvementAwardCutoff) *
              10 *
              3
          )
          if (
            cumulativePlacingRatiosByYear[year].improvement >=
            improvementAwardCutoff
          )
            return {
              type: 'improvement',
              label: year,
              title: `${year} Improvement`,
              description: `Average placing improved <span style="font-weight: bold; color:var(--l${level});">${Math.round(
                cumulativePlacingRatiosByYear[year].improvement * 100
              )}%</span> in ${year}`,
              level,
              progress: 0,
            }
        })
        .filter(a => a)

      return yearAwards
    },
  },
}
</script>

<style lang="scss" scoped>
.awardslabel {
  margin: 0.5em 0 0 0;
}

.awards {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fit, 60px);
  grid-gap: 5px;
}
.award {
  position: relative;
  width: 60px;
  height: 60px;
  outline: none;
  background: var(--grayl);
  border: none;
  border-radius: 50%;
  box-shadow: inset 0 -7px 15px 3px var(--gray);
  background-color: var(--grayd);
  background-repeat: no-repeat;
  background-blend-mode: hard-light;
  background-size: 100%;
  background-position: center center;
  cursor: help;
  padding: 3px;
  // color: var(--bg);
  font-size: 1.1rem;
  font-weight: bold;
  box-shadow: 0 5px 10px var(--grayd);
  transition: all 0.3s;

  &:hover,
  &:active,
  &.focus {
    box-shadow: 0 10px 20px var(--grayd2);
  }

  &.fade {
    opacity: 0.5;
  }
}

.label {
  pointer-events: none;
  position: absolute;
  bottom: 5%;
  left: 50%;
  transform: translateX(-50%);
  letter-spacing: -0.5px;
}

.improvement {
  background-image: url('~assets/img/up_arrow.svg');
}
.oneweek {
  background-image: url('~assets/img/flash.svg');
}
.weeksinarow {
  background-image: url('~assets/img/reload.svg');
}
.streak {
  background-image: url('~assets/img/dashboard.svg');
}

.tooltip {
  position: absolute;
  pointer-events: none;
  top: 110%;
  // left: 50%;
  z-index: 2000;
  line-height: 1.1;
  font-size: 1rem;
  width: 200px;
  text-align: center;
  font-weight: 400;
  padding: 15px 10px;
  background: hsla(0, 0%, 0%, 0.8);
  color: var(--bg);
  // transform: translateX(-50%);

  h3 {
    margin: 0 0 8px 0;
    font-size: 1.4em;
    line-height: 1;
  }

  .sub {
    margin: 5px 0;
  }

  .level {
    font-weight: bold;
    margin-bottom: 5px;
  }
}

.divider {
  height: 70%;
  margin: 20% 0;
  width: 55%;
  border-right: 1px solid var(--grayd);
  display: flex;
  align-items: center;
  padding: 0 0 0 10px;
}

.inprogress {
  margin-top: 20px;
  width: 40px;
  height: 40px;
  position: relative;
  background-color: hsla(0, 0%, 92%, 1);
  background-size: 80%;
  box-shadow: none;

  &:hover,
  &:active,
  &.focus {
    box-shadow: none;
  }

  .label {
    font-size: 0.8em;
    color: var(--grayd2);
  }
}

.progress {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transform: rotate(90deg);
  stroke-dasharray: 315; // 315 is 100%
  stroke-dashoffset: 315;
  stroke: var(--text);
  transition: all 0.5s;
}
</style>
