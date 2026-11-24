import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { faker, fakerPassword, fakerPortalHost, fakerUsername } from './factories.mjs'
import {
  DEFAULT_TRANSCODE_ORIGIN,
  resolveLeanbackSource,
  shouldTranscodeProgressive,
  transcodeOriginOf,
  transcodePlaybackUrl,
} from '../src/leanbackVod.mjs'

const HLS_TYPE = 'application/vnd.apple.mpegurl'

beforeEach(() => {
  faker.seed(1837892)
})

afterEach(() => {
  delete globalThis.OpenFlixHouse
})

function movieUrl() {
  return `http://${fakerPortalHost()}/movie/${fakerUsername()}/${fakerPassword()}/1837892.mp4`
}

test('mp4 no projetor aponta para o HLS 720p no Mac da LAN', () => {
  const src = movieUrl()
  const got = transcodePlaybackUrl(src)
  const parsed = new URL(got)
  assert.equal(`${parsed.protocol}//${parsed.host}`, DEFAULT_TRANSCODE_ORIGIN)
  assert.equal(parsed.pathname, '/v/index.m3u8')
  assert.equal(parsed.searchParams.get('src'), src)
})

test('origem do transcode vem do OpenFlixHouse quando existe', () => {
  const origin = `http://192.168.15.${faker.number.int({ min: 2, max: 20 })}:8793`
  assert.equal(transcodeOriginOf({ transcodeOrigin: origin }), origin)
  globalThis.OpenFlixHouse = { transcodeOrigin: `${origin}/` }
  assert.equal(transcodeOriginOf(), origin)
})

test('só rebaixa progressivo e sidecar no leanback', () => {
  assert.equal(shouldTranscodeProgressive({ leanback: true, sourceKind: 'progressive' }), true)
  assert.equal(shouldTranscodeProgressive({ leanback: true, sourceKind: 'sidecar' }), true)
  assert.equal(shouldTranscodeProgressive({ leanback: true, sourceKind: 'hls' }), false)
  assert.equal(shouldTranscodeProgressive({ leanback: false, sourceKind: 'progressive' }), false)
})

test('resolve no projetor troca mp4 por HLS; no desktop mantém o arquivo', () => {
  const src = movieUrl()
  const canPlay = (type) => (type === HLS_TYPE ? 'maybe' : '')
  const desktop = resolveLeanbackSource(src, { leanback: false, canPlay })
  assert.equal(desktop.kind, 'progressive')
  assert.equal(desktop.url, src)
  const projector = resolveLeanbackSource(src, { leanback: true, canPlay })
  assert.equal(projector.kind, 'hls')
  assert.equal(projector.url, transcodePlaybackUrl(src))
})
