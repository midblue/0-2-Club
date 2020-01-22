<template>
  <section>
    <div>
      Tag:
      <input v-model="inputTag" placeholder="tag" />
    </div>
    <div>
      Game:
      <select v-model="inputGame">
        <option value="Super Smash Bros. Melee">Super Smash Bros. Melee</option>
        <option value="Super Smash Bros. Ultimate">Super Smash Bros. Ultimate</option>
      </select>
    </div>
    <nuxt-link
      :to="
        `/g/${encodeURIComponent(inputGame)}/t/${encodeURIComponent(inputTag)}`
      "
    >
      <button>Go</button>
    </nuxt-link>
    <div>{{ players }} players and {{ events }} events loaded</div>
  </section>
</template>

<script>
import axios from '~/plugins/axios'

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
  data() {
    return {
      inputGame: 'Super Smash Bros. Melee',
      inputTag: 'Ekans',
    }
  },
}
</script>

<style scoped></style>
