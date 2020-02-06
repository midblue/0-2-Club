export const state = () => ({
  isLoading: false,
  isMobile: true,
})

export const mutations = {
  setIsLoading(state, isLoading) {
    state.isLoading = isLoading
  },
  setIsMobile(state, isMobile) {
    state.isMobile = isMobile
  },
}
