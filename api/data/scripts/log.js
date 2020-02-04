const minLength = 9
const resetColor = '\x1b[0m'
const terminalColors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[2m',
}

module.exports = function(
  name,
  color = 'green',
  showTimeStamp = false
) {
  const isBrowser = typeof window !== 'undefined'
  let prefix = name + ' '
  while (prefix.length < minLength) prefix += ' '
  if (isBrowser)
    return (...args) => {
      console.log(
        `%c${prefix}%c`,
        `color: ${color}`,
        `color: black`,
        ...args
      )
    }
  return (...args) => {
    const colorCode = terminalColors[color] || terminalColors.white
    let timeStamp
    if (showTimeStamp) {
      const time = new Date()
      let hours = time.getHours()
      let minutes = time.getMinutes()
      let seconds = time.getSeconds()
      let ms = time.getMilliseconds()
      if (hours < 10) hours = '0' + hours
      if (minutes < 10) minutes = '0' + minutes
      if (seconds < 10) seconds = '0' + seconds
      while (`${ms}`.length < 3) ms = ms + '0'
      timeStamp = hours + ':' + minutes + ':' + seconds + '.' + ms
    }

    console.log(
      terminalColors.gray +
        ((showTimeStamp ? timeStamp + ' ' : '') +
          resetColor +
          colorCode +
          prefix),
      ...args,
      resetColor
    )
  }
}
