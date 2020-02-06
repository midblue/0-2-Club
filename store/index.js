export const state = () => ({
  isLoading: false,
  isMobile: false,
})

export const mutations = {
  setIsLoading(state, isLoading) {
    state.isLoading = isLoading
  },
  setIsMobile(state, isMobile) {
    state.isMobile = isMobile
  },
}
