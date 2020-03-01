export const state = () => ({
  isLoading: false,
  isMobile: false,
  winWidth: 1000,
  player: {},
})

export const mutations = {
  setIsLoading(state, isLoading) {
    state.isLoading = isLoading
  },
  setIsMobile(state, isMobile) {
    state.isMobile = isMobile
  },
  setWinWidth(state, winWidth) {
    state.winWidth = winWidth
  },
  setPlayer(state, payload) {
    for (let p in payload) state.player[p] = payload[p]
  },
}
