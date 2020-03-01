module.exports = {
  head: {
    titleTemplate(titleChunk) {
      return (titleChunk ? titleChunk + ' | ' : '') + `The 0-2 Club`
    },
    meta: [
      { charset: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        property: 'og:title',
        hid: `og:title`,
        content: 'The 0-2 Club',
      },
      {
        property: 'og:description',
        hid: `og:description`,
        content:
          'Track your progress, keep improving, and stay motivated — an esports fitbit for anyone getting started in competitive gaming.',
      },
      { hid: `og:type`, property: 'og:type', content: 'website' },
      {
        hid: `og:site_name`,
        property: 'og:site_name',
        content: 'The 0-2 Club',
      },
      {
        hid: `og:image`,
        property: 'og:image',
        content: `http://www.0-2.club/thumb.png`,
      },
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    ],
    script: [
      {
        src:
          'https://www.googletagmanager.com/gtag/js?id=G-4QVMMRTV5R',
        async: true,
      },
    ],
  },
  css: ['~/assets/css/main.scss'],
  axios: {
    progress: true,
    retry: false,
    timeout: 360000,
  },
  serverMiddleware: ['~/api/index.js'],
  watch: ['~/api/*.js', '~/api/*/*.js', '~/api/*/*/*.js'],
}
