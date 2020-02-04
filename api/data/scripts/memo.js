module.exports = function(limit) {
  return {
    memos: {},
    limit,
    set: function(key, value) {
      this.memos[key] = { ...value, memoAddedTime: Date.now() }
      if (!this.limit || Object.keys(this.memos).length <= this.limit)
        return
      const oldest = Object.keys(this.memos).reduce(
        (oldest, current) =>
          this.memos[current].memoAddedTime < oldest.memoAddedTime
            ? { ...this.memos[current], memoKey: current }
            : oldest,
        { memoAddedTime: Date.now() }
      )
      if (oldest.key) delete this.memos[oldest.key]
      console.log('memo deleted, length:', this.memos.length)
    },
    get: function(key) {
      const found = this.memos[key]
      if (found) delete found.memoAddedTime
      return found
    },
  }
}
