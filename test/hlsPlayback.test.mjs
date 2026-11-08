import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { faker } from './factories.mjs'
import { attachHlsPlayback, preferNativeHls } from '../src/hlsPlayback.mjs'

const HLS_TYPE = 'application/vnd.apple.mpegurl'
const loads = []
const attached = []

class FakeHls {
  static isSupported() {
    return true
  }
  loadSource(url) {
    loads.push(url)
  }
  attachMedia(video) {
    attached.push(video)
  }
  destroy() {
    this.destroyed = true
  }
}

const dom = new JSDOM('<!doctype html><video></video>')
globalThis.document = dom.window.document

beforeEach(() => {
  faker.seed(74)
  loads.length = 0
  attached.length = 0
})

function liveUrl() {
  return `http://${faker.internet.domainName()}/live/user/pass/1658633.m3u8`
}

test('preferNative com canPlay usa o src do video e não cria hls.js', () => {
  const video = document.createElement('video')
  const url = liveUrl()
  const session = attachHlsPlayback(video, url, {
    Hls: FakeHls,
    preferNative: true,
    canPlay: (type) => (type === HLS_TYPE ? 'maybe' : ''),
  })
  assert.equal(session.kind, 'native')
  assert.equal(video.src, url)
  assert.equal(loads.length, 0)
})

test('sem preferNative usa hls.js mesmo com HLS nativo no canPlay', () => {
  const video = document.createElement('video')
  const url = liveUrl()
  const session = attachHlsPlayback(video, url, {
    Hls: FakeHls,
    fetch: async () => {},
    preferNative: false,
    canPlay: (type) => (type === HLS_TYPE ? 'maybe' : ''),
  })
  assert.equal(session.kind, 'hlsjs')
  assert.equal(loads[0], url)
  assert.equal(attached[0], video)
  assert.equal(video.getAttribute('src'), null)
  session.destroy()
  assert.equal(session.destroyed ?? FakeHls.prototype.destroyed, undefined)
})

test('depois do manifesto o hls.js chama play no video', () => {
  const video = document.createElement('video')
  const plays = []
  video.play = () => {
    plays.push(1)
    return Promise.resolve()
  }
  class ReadyHls extends FakeHls {
    static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' }
    on(event, cb) {
      this.listeners = this.listeners ?? {}
      this.listeners[event] = cb
    }
    attachMedia(media) {
      super.attachMedia(media)
      this.listeners?.hlsManifestParsed?.()
    }
  }
  attachHlsPlayback(video, liveUrl(), {
    Hls: ReadyHls,
    fetch: async () => {},
    preferNative: false,
  })
  assert.equal(plays.length, 1)
})

test('sessão hls.js expõe seekToLive na borda liveSyncPosition', () => {
  const video = document.createElement('video')
  const edge = faker.number.float({ min: 40, max: 90, fractionDigits: 1 })
  video.currentTime = 2
  class LiveHls extends FakeHls {
    get liveSyncPosition() {
      return edge
    }
  }
  const session = attachHlsPlayback(video, liveUrl(), {
    Hls: LiveHls,
    fetch: async () => {},
    preferNative: false,
  })
  assert.equal(session.seekToLive(), true)
  assert.equal(video.currentTime, edge)
})

test('depois do manifesto live o hls.js pula para liveSyncPosition', () => {
  const video = document.createElement('video')
  const edge = faker.number.float({ min: 50, max: 110, fractionDigits: 1 })
  video.currentTime = 0
  video.play = () => Promise.resolve()
  class ReadyLiveHls extends FakeHls {
    static Events = { MANIFEST_PARSED: 'hlsManifestParsed', ERROR: 'hlsError' }
    get liveSyncPosition() {
      return edge
    }
    on(event, cb) {
      this.listeners = this.listeners ?? {}
      this.listeners[event] = cb
    }
    attachMedia(media) {
      super.attachMedia(media)
      this.listeners?.hlsManifestParsed?.()
    }
  }
  attachHlsPlayback(video, liveUrl(), {
    Hls: ReadyLiveHls,
    fetch: async () => {},
    preferNative: false,
  })
  assert.equal(video.currentTime, edge)
})

test('destroy da sessão hls.js chama destroy do engine', () => {
  const video = document.createElement('video')
  const hls = []
  class TrackedHls extends FakeHls {
    constructor() {
      super()
      hls.push(this)
    }
  }
  const session = attachHlsPlayback(video, liveUrl(), {
    Hls: TrackedHls,
    fetch: async () => {},
    preferNative: false,
  })
  session.destroy()
  assert.equal(hls[0].destroyed, true)
})

test('no Tauri o HLS remoto fica no hls.js e o loopback vai nativo', () => {
  const remote = liveUrl()
  const port = faker.internet.port()
  const loopback = `http://127.0.0.1:${port}/video/${faker.string.alphanumeric(11)}.m3u8`
  assert.equal(preferNativeHls(remote, { inTauri: true }), false)
  assert.equal(preferNativeHls(loopback, { inTauri: true }), true)
  assert.equal(preferNativeHls(remote, { inTauri: false }), true)
})

test('loopback no Tauri com canPlay usa o src do video', () => {
  const video = document.createElement('video')
  const url = `http://127.0.0.1:${faker.internet.port()}/video/${faker.string.alphanumeric(11)}.m3u8`
  const session = attachHlsPlayback(video, url, {
    Hls: FakeHls,
    fetch: async () => {},
    preferNative: preferNativeHls(url, { inTauri: true }),
    canPlay: (type) => (type === HLS_TYPE ? 'maybe' : ''),
  })
  assert.equal(session.kind, 'native')
  assert.equal(video.src, url)
  assert.equal(loads.length, 0)
})
