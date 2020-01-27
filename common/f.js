export default {
  parseParticipantTag(name) {
    const minusTeam = /^(?:[^|]*(?: *[|]+ *)+)?(.*)$/gi.exec(name)
    return minusTeam ? minusTeam[1] : null
  },
}
