// Blocking garbage domains, maybe use puppeteer adblock plugin --------------------------
const fatUrls = `fontawesome.com`

export const fat_urls_re = new RegExp(fatUrls.split(/[\n\s]+/).map((s) => `[/\\.]${s}[/\\.$]`).join('|'), 'i')

const garbage_domains = `appunification
  appunification
  transactionunification
  requestunification
  dataunification
  appunification
  applicationunity
  approachdata
  quantserve
  googletagmanager
  investingchannel
  google-analytics
  fonts.gstatic
  doubleclick
  wsod
  dianomi
  bounceexchange
  firstimpression
  adsrvr
  advertising
  casalemedia
  adnxs
  deployads
  adservice.google
  criteo
  getclicky
  agkn
  powerlinks
  bluekai
  mathtag
  eyeota
  nex8
  openx
  turn
  pippio
  googletagservices
  ml314
  krxd
  approachdata
  deployads
  pubmatic
  googlesyndication
  apxy
  quantcount
  approachdata
  applicationunifier
  transactionunification
  approachdata
  applicationunificationcontroller
  mouseflow
  ipstackmoatads
  googleadservices
  jwpcdn
  aimatch
  jwpcdn`

export function build_re_for_domains(domains: string) {
  return new RegExp(
    domains.split(/[\n\s]+/).map((s) => `[/\\.]${s}\\.(com|info|org|io|net)[/\\.$]`).join('|'), 'i')
}

export const garbage_domains_re = build_re_for_domains(garbage_domains)

export const garbage_urls = `ad-m.asia
  cloudfront.net/ads`

export const garbage_urls_re = new RegExp(
  garbage_urls.split(/[\n\s]+/).map((s) => `[/\\.]${s}[/\\.$]`).join('|'), 'i')

export const images_re = /favicon.ico$|^data:image|\.jpg$|\.jpeg$|\.png$|\.giff$|\.svg$/

export const fonts_re = /^data:font-woff|\.woff2$|\.woff$|^data:application\/x-font-woff/

export const block_urls = [
  images_re,
  fonts_re,
  garbage_domains_re,
  garbage_urls_re,
  fat_urls_re
]