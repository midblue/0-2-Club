/* official game titles */
module.exports = [
  // Super Smash Bros. Melee
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?M(?:elee\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Melee'
  },

  // Super Smash Bros. Ultimate
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?U(?:ltimate\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Ultimate'
  },

  // Super Smash Bros. Brawl
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?B(?:rawl\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros. Brawl'
  },

  // Super Smash Bros.
  q => {
    const match = /S(?:uper\s*)?S(?:mash\s*)?B(?:ro(?:ther)?s\.?\s*)?/gi.exec(
      q
    )
    if (match) return 'Super Smash Bros.'
  },
]
