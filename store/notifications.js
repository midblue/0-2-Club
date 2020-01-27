export const state = () => ({
  list: [],
})

export const mutations = {
  add(state, notification) {
    state.list.push(notification)
  },

  remove(state, notification) {
    state.list.shift()
  },
}

export const actions = {
  notify({ commit }, notification) {
    commit('add', notification)
    setTimeout(() => commit('remove'), 2500)
  },
}
