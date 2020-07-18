module.exports = [
  {
    regex: /(127.0.0.1|::1)/g,
    name: 'localhost',
  },
  // google is 66.249.64.0 - 66.249.95.255
  {
    regex: /66.249./g,
    name: 'Google',
    log: false,
  },
  {
    regex: /(118.111.157.140|118.111.162.56)/g,
    name: 'Me',
  },
  {
    regex: /216.244.66.199/g,
    name: 'wowrack.com',
    allowed: false,
    log: false,
  },
  {
    regex: /(136.243.70.151|144.76.60.198|148.251.)/g,
    name: 'Hetzner Online',
    allowed: false,
    log: false,
  },
  { regex: /173.212.246.178/g, name: 'Contabo GmbH' },
  {
    regex: /40.77.167.181/g,
    name: 'Bing',
  },
  {
    regex: /(173.252.95.|66.220.149.)/g,
    name: 'Facebook',
  },
  {
    regex: /199.59.150./g,
    name: 'Twitter',
  },
]
