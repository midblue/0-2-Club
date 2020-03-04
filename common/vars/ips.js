module.exports = [
  {
    regex: /127\.0\.0\.1/g,
    name: 'localhost',
  },
  {
    regex: /66\.249\./g,
    name: 'Google',
    log: false,
  },
  {
    regex: /118\.111\.157\.140/g, // todo sometimes not firing intermittently, trailing space?
    name: 'Me',
  },
  {
    regex: /216\.244\.66\.199/g,
    name: 'wowrack.com',
    allowed: false,
    log: false,
  },
  {
    regex: /136\.243\.70\.151/g,
    name: 'Hetzner Online',
  },
  {
    regex: /40\.77\.167\.181/g,
    name: 'Bing',
  },
  {
    regex: /173\.252\.95\./g,
    name: 'Facebook',
  },
  {
    regex: /199\.59\.150\./g,
    name: 'Twitter',
  },
]
