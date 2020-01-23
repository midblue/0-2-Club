<template>
  <section>
    <div>
      <div class="header">
        <h1>Welcome to <br />the club.</h1>
      </div>
      <h3>
        Track your progress, keep improving, and stay motivated — <br />An
        <span class="highlight">esports fitbit</span> for anyone getting started
        in competitive gaming.
      </h3>

      <PanelButton>
        <div>
          <h2>
            Tag
            <input v-model="inputTag" placeholder="tag" />
          </h2>
          <h2>
            Game
            <select v-model="inputGame">
              <option value="Super Smash Bros. Melee"
                >Super Smash Bros. Melee</option
              >
              <option value="Super Smash Bros. Ultimate"
                >Super Smash Bros. Ultimate</option
              >
            </select>
          </h2>
        </div>
        <template #button>
          <nuxt-link
            :to="
              `/g/${encodeURIComponent(inputGame)}/t/${encodeURIComponent(
                inputTag
              )}`
            "
          >
            <button class="fullsize">Go</button>
          </nuxt-link>
        </template>
      </PanelButton>

      <div class="sub negmartop">
        {{ players }} players and {{ events }} events analyzed so far.
      </div>

      <br />
      <br />
      <div>
        <b>See it in action:</b>
        <nuxt-link to="/g/Super%20Smash%20Bros.%20Melee/t/H0P">H0P</nuxt-link>
        ・
        <nuxt-link to="/g/Super%20Smash%20Bros.%20Ultimate/t/Zaheer"
          >Zaheer</nuxt-link
        >
      </div>

      <br />
      <br />
      <hr />
      <br />
      <br />

      <div class="intro">
        <div class="text">
          <h4>See Your Growth</h4>
          If you feel like you've been leveling up this year, now you can prove
          it. Your progress is charted over time, and you can compare your
          growth with your peers.
        </div>

        <div class="text">
          <h4>Points for All</h4>
          In training, victory isn't as important as growth and consistency.
          Lose a tight set to a strong player? That's worth some points. Support
          your local scene? Points city.
        </div>

        <div class="text">
          <h4>Easy Data Handling</h4>
          Just link us one tournament with you in it, and we'll automatically
          snag more. Currently supports all 1v1 tournaments for any game hosted
          through smash.gg.
        </div>
      </div>
    </div>
  </section>
</template>

<script>
import axios from '~/plugins/axios'
import PanelButton from '~/components/PanelButton'

export default {
  async asyncData() {
    let { data } = await axios.get(`/api/stats`)
    return data
  },
  head() {
    return {
      title: 'Users',
    }
  },
  components: { PanelButton },
  data() {
    return {
      inputGame: 'Super Smash Bros. Melee',
      inputTag: 'Ekans',
    }
  },
}
</script>

<style scoped lang="scss">
.header {
  padding-top: 1px;
}

.negmartop {
  margin-top: -40px;
}

.intro {
  .text {
    max-width: 400px;
    margin-bottom: 50px;
  }
}

.fullsize {
  margin: 0;
  width: 100%;
  height: 100%;
}
</style>
