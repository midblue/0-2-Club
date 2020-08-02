const puppeteer = require('puppeteer')

let browser, page

setup()

async function setup() {
  browser = await puppeteer.launch()
  page = await browser.newPage()
  // don't load images
  await page.setRequestInterception(true)
  page.on('request', request => {
    if (request.resourceType() === 'image') request.abort()
    else request.continue()
  })
}

module.exports = async (url, selector) => {
  while (!page) await sleep(100)
  // console.log('loading url', url)
  await page.goto(url)
  await page.waitFor(selector)
  const results = await page.$$(selector)
  // if (results) console.log('found', selector, 'on page.')
  return results
}

const sleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds))
