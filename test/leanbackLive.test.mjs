import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { faker, fakerPassword, fakerPortalHost, fakerUsername } from './factories.mjs'
import {
  DEFAULT_LIVE_ORIGIN,
  liveOriginOf,
  livePlaybackUrl,
  resolveLeanbackSource,
  shouldRestreamLive,
} from '../src/leanbackVod.mjs'

const HLS_TYPE = 'application/vnd.apple.mpegurl'

beforeEach(() => {
  faker.seed(8794)
})

afterEach(() => {
  delete globalThis.OpenFlixHouse
})

function liveUrl() {
  return `http://${fakerPortalHost()}/live/${fakerUsername()}/${fakerPassword()}/62.m3u8`
}

test('live no projetor aponta para a janela HLS no Mac da LAN', () => {
  const src = liveUrl()
  const got = livePlaybackUrl(src)
  const parsed = new URL(got)
  assert.equal(`${parsed.protocol}//${parsed.host}`, DEFAULT_LIVE_ORIGIN)
  assert.equal(parsed.pathname, '/live/index.m3u8')
  assert.equal(parsed.searchParams.get('src'), src)
})

test('origem da live vem do OpenFlixHouse quando existe', () => {
  const origin = `http://192.168.15.${faker.number.int({ min: 2, max: 20 })}:8794`
  assert.equal(liveOriginOf({ liveOrigin: origin }), origin)
  globalThis.OpenFlixHouse = { liveOrigin: `${origin}/` }
  assert.equal(liveOriginOf(), origin)
})

test('só restrea HLS de /live/ no leanback', () => {
  const src = liveUrl()
  assert.equal(shouldRestreamLive({ leanback: true, sourceKind: 'hls', url: src }), true)
  assert.equal(shouldRestreamLive({ leanback: false, sourceKind: 'hls', url: src }), false)
  assert.equal(
    shouldRestreamLive({
      leanback: true,
      sourceKind: 'hls',
      url: `http://${fakerPortalHost()}/movie/x/y/1.m3u8`,
    }),
    false,
  )
  assert.equal(
    shouldRestreamLive({
      leanback: true,
      sourceKind: 'hls',
      url: `${DEFAULT_LIVE_ORIGIN}/live/index.m3u8?src=${encodeURIComponent(src)}`,
    }),
    false,
  )
})

test('resolve no projetor troca live XC por janela HLS; no desktop mantém o portal', () => {
  const src = liveUrl()
  const canPlay = (type) => (type === HLS_TYPE ? 'maybe' : '')
  const desktop = resolveLeanbackSource(src, { leanback: false, canPlay })
  assert.equal(desktop.kind, 'hls')
  assert.equal(desktop.url, src)
  const projector = resolveLeanbackSource(src, { leanback: true, canPlay })
  assert.equal(projector.kind, 'hls')
  assert.equal(projector.url, livePlaybackUrl(src))
})
