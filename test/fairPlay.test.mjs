import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'

faker.seed(20261111)

const {
  attachFairPlay,
  base64ToBytes,
  bytesToBase64,
  fairPlaySupported,
  legacyInitData,
  pickAudioTrack,
  skdInitData,
  skdKeyId,
  utf16leBytes,
} = await import('../src/fairPlay.mjs')

beforeEach(() => {
  faker.seed(20261111)
})

class FakeVideo {
  constructor() {
    this.listeners = new Map()
    this.mediaKeys = null
  }

  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? []
    list.push(listener)
    this.listeners.set(type, list)
  }

  removeEventListener(type, listener) {
    const list = (this.listeners.get(type) ?? []).filter((item) => item !== listener)
    this.listeners.set(type, list)
  }

  setMediaKeys(keys) {
    this.mediaKeys = keys
    return Promise.resolve()
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) listener({ target: this, ...event })
  }
}

class FakeSession {
  constructor() {
    this.listeners = new Map()
    this.updates = []
    this.generated = null
    this.closed = false
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }

  generateRequest(initDataType, initData) {
    this.generated = { initDataType, initData }
    return Promise.resolve()
  }

  update(bytes) {
    this.updates.push([...bytes])
    return Promise.resolve()
  }

  close() {
    this.closed = true
  }

  emit(type, event) {
    this.listeners.get(type)?.({ target: this, ...event })
  }
}

class FakeLegacyVideo extends FakeVideo {
  constructor() {
    super()
    this.webkitKeys = null
  }
}

class FakeLegacySetterVideo extends FakeVideo {
  constructor() {
    super()
    this.keys = null
    this.setterUsed = false
  }

  get webkitKeys() {
    return this.keys
  }

  webkitSetMediaKeys(keys) {
    this.keys = keys
    this.setterUsed = true
    return Promise.resolve()
  }
}

class FakeLegacySession {
  constructor() {
    this.listeners = new Map()
    this.updates = []
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }

  update(bytes) {
    this.updates.push([...bytes])
  }

  close() {
    this.closed = true
  }

  emit(type, event) {
    this[`on${type}`]?.({ target: this, ...event })
    this.listeners.get(type)?.({ target: this, ...event })
  }
}

function fakeLegacyKeys({ keySystems, sessions, certificates }) {
  return class FakeWebKitMediaKeys {
    constructor(keySystem) {
      this.keySystem = keySystem
      keySystems.push(keySystem)
    }

    setServerCertificate(bytes) {
      certificates.push([...bytes])
      return Promise.resolve(true)
    }

    createSession(contentType, initData) {
      const session = new FakeLegacySession()
      session.contentType = contentType
      session.initData = initData
      sessions.push(session)
      return session
    }
  }
}

function fakeAccess({ sessions, certificates }) {
  const mediaKeys = {
    setServerCertificate(bytes) {
      certificates.push([...bytes])
      return Promise.resolve(true)
    },
    createSession() {
      const session = new FakeSession()
      sessions.push(session)
      return session
    },
  }
  return async (keySystem) => {
    assert.equal(keySystem, 'com.apple.fps')
    return { createMediaKeys: async () => mediaKeys }
  }
}

test('base64 e skd:// fazem o caminho de ida e volta', () => {
  const bytes = new Uint8Array([0, 1, 2, 250, 255])
  assert.deepEqual([...base64ToBytes(bytesToBase64(bytes))], [...bytes])
  assert.equal(skdKeyId(new TextEncoder().encode('skd://abc-123')), 'skd://abc-123')
  assert.equal(skdKeyId(new TextEncoder().encode('https://x')), '')
})

test('skdInitData normaliza o initData UTF-16 do WKWebView para UTF-8', () => {
  const uri = `skd://${faker.string.uuid()}`
  const utf16 = new Uint8Array(4 + uri.length * 2)
  new DataView(utf16.buffer).setUint32(0, uri.length * 2, true)
  for (let index = 0; index < uri.length; index += 1) {
    const code = uri.charCodeAt(index)
    utf16[4 + index * 2] = code & 0xff
    utf16[5 + index * 2] = code >> 8
  }
  assert.equal(new TextDecoder().decode(skdInitData(utf16)), uri)
  const plain = new TextEncoder().encode(uri)
  assert.equal(new TextDecoder().decode(skdInitData(plain)), uri)
})

test('attachFairPlay usa o WebKitMediaKeys legado do WKWebView', async () => {
  const keySystems = []
  const sessions = []
  const certificates = []
  globalThis.WebKitMediaKeys = fakeLegacyKeys({ keySystems, sessions, certificates })
  try {
    const video = new FakeLegacyVideo()
    let challenge = ''
    const detach = await attachFairPlay(video, {
      certBase64: bytesToBase64(new Uint8Array([1, 2, 3])),
      license: async (spc) => {
        challenge = spc
        return bytesToBase64(new Uint8Array([9]))
      },
      requestAccess: () => {
        throw new Error('EME não deve ser usado quando o legado existe')
      },
    })
    assert.equal(video.webkitKeys?.keySystem, 'com.apple.fps')
    assert.deepEqual(certificates[0], [1, 2, 3])
    const keyUri = `skd://${faker.string.uuid()}`
    const initData = new TextEncoder().encode(keyUri)
    video.emit('webkitneedkey', { initData })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(sessions.length, 1)
    assert.equal(sessions[0].contentType, 'video/mp4')
    const payload = sessions[0].initData
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
    const uriSize = view.getUint32(0, true)
    assert.equal(uriSize, initData.length * 2)
    assert.equal(new TextDecoder('utf-16le').decode(payload.slice(4, 4 + uriSize)), keyUri)
    const certOffset = 4 + uriSize + 4 + uriSize
    assert.equal(view.getUint32(certOffset, true), 3)
    assert.deepEqual([...payload.slice(certOffset + 4)], [1, 2, 3])
    sessions[0].emit('webkitkeymessage', { message: new Uint8Array([4, 5, 6]).buffer })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(challenge, 'BAUG')
    assert.deepEqual(sessions[0].updates[0], [9])
    detach()
    assert.equal(video.webkitKeys, null)
    assert.equal(video.listeners.get('webkitneedkey').length, 0)
  } finally {
    delete globalThis.WebKitMediaKeys
  }
})

test('legacyInitData monta key, key e certificado DER', () => {
  const keyUri = `skd://${faker.string.uuid()}`
  const payload = legacyInitData(keyUri, new Uint8Array([7, 8, 9]))
  const view = new DataView(payload.buffer)
  const size = view.getUint32(0, true)
  assert.equal(size, utf16leBytes(keyUri).length)
  assert.equal(new TextDecoder('utf-16le').decode(payload.slice(4, 4 + size)), keyUri)
  const second = 4 + size
  assert.equal(view.getUint32(second, true), size)
  const certOffset = second + 4 + size
  assert.equal(view.getUint32(certOffset, true), 3)
  assert.deepEqual([...payload.slice(certOffset + 4)], [7, 8, 9])
})

test('attachFairPlay prefere webkitSetMediaKeys quando webkitKeys é readonly', async () => {
  const keySystems = []
  const sessions = []
  const certificates = []
  globalThis.WebKitMediaKeys = fakeLegacyKeys({ keySystems, sessions, certificates })
  try {
    const video = new FakeLegacySetterVideo()
    const detach = await attachFairPlay(video, {
      certBase64: bytesToBase64(new Uint8Array([1])),
      license: async () => bytesToBase64(new Uint8Array([9])),
      requestAccess: () => {
        throw new Error('EME não deve ser usado quando o legado existe')
      },
    })
    assert.equal(video.setterUsed, true)
    assert.equal(video.webkitKeys?.keySystem, 'com.apple.fps')
    detach()
    assert.equal(video.webkitKeys, null)
  } finally {
    delete globalThis.WebKitMediaKeys
  }
})

test('attachFairPlay instala o certificado e responde o desafio da licença', async () => {
  const video = new FakeVideo()
  const sessions = []
  const certificates = []
  let challenge = ''
  const license = async (spc) => {
    challenge = spc
    return bytesToBase64(new Uint8Array([9, 10, 11]))
  }
  const events = []
  const detach = await attachFairPlay(video, {
    certBase64: bytesToBase64(new Uint8Array([1, 2, 3])),
    license,
    onEvent: (step) => events.push(step),
    requestAccess: fakeAccess({ sessions, certificates }),
  })
  assert.equal(video.mediaKeys !== null, true)
  assert.deepEqual(certificates[0], [1, 2, 3])

  video.emit('encrypted', {
    initDataType: 'skd',
    initData: new TextEncoder().encode(`skd://${faker.string.uuid()}`),
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(sessions.length, 1)
  assert.equal(sessions[0].generated.initDataType, 'skd')
  assert.match(new TextDecoder().decode(sessions[0].generated.initData), /^skd:\/\//)

  sessions[0].emit('message', { message: new Uint8Array([4, 5, 6]).buffer })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(challenge, 'BAUG')
  assert.deepEqual(sessions[0].updates[0], [9, 10, 11])

  detach()
  assert.equal(sessions[0].closed, true)
  assert.deepEqual(events, ['keys-ready', 'encrypted', 'challenge', 'license', 'updated'])
  assert.equal(video.listeners.get('encrypted').length, 0)
})

test('attachFairPlay atende o webkitneedkey do WKWebView uma vez só', async () => {
  const video = new FakeVideo()
  const sessions = []
  let calls = 0
  const detach = await attachFairPlay(video, {
    certBase64: 'AAEC',
    license: async () => {
      calls += 1
      return bytesToBase64(new Uint8Array([1]))
    },
    requestAccess: fakeAccess({ sessions, certificates: [] }),
  })
  const initData = new TextEncoder().encode(`skd://${faker.string.uuid()}`)
  video.emit('webkitneedkey', { initData })
  await new Promise((resolve) => setImmediate(resolve))
  sessions[0].emit('message', { message: new Uint8Array([4]).buffer })
  await new Promise((resolve) => setImmediate(resolve))
  video.emit('webkitneedkey', { initData })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(sessions.length, 1)
  assert.equal(calls, 1)
  detach()
})

test('attachFairPlay ignora initData que não é skd e reporta erro de licença', async () => {
  const video = new FakeVideo()
  const sessions = []
  const errors = []
  const detach = await attachFairPlay(video, {
    certBase64: 'AAEC',
    license: async () => {
      throw new Error('licença recusada')
    },
    onError: (error) => errors.push(error.message),
    requestAccess: fakeAccess({ sessions, certificates: [] }),
  })
  video.emit('encrypted', { initDataType: 'cenc', initData: new Uint8Array([1]) })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(sessions.length, 0)
  video.emit('encrypted', { initDataType: 'skd', initData: new Uint8Array([1]) })
  await new Promise((resolve) => setImmediate(resolve))
  sessions[0].emit('message', { message: new Uint8Array([7]).buffer })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(errors, ['licença recusada'])
  detach()
})

test('attachFairPlay recusa EME ausente', async () => {
  await assert.rejects(
    () =>
      attachFairPlay(new FakeVideo(), {
        certBase64: 'AAEC',
        license: async () => '',
        requestAccess: null,
      }),
    /fairplay recusado: recebido EME ausente, esperado WKWebView com com\.apple\.fps/,
  )
})

test('fairPlaySupported exige Tauri, macOS e EME', () => {
  const requestAccess = () => {}
  assert.equal(
    fairPlaySupported({
      inTauri: true,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
      requestAccess,
    }),
    true,
  )
  assert.equal(fairPlaySupported({ inTauri: false, userAgent: 'Macintosh', requestAccess }), false)
  assert.equal(
    fairPlaySupported({ inTauri: true, userAgent: 'Mozilla/5.0 (Windows NT 10.0)', requestAccess }),
    false,
  )
  assert.equal(
    fairPlaySupported({ inTauri: true, userAgent: 'Macintosh', requestAccess: null }),
    false,
  )
})

test('pickAudioTrack liga o português e desliga o resto', () => {
  const tracks = [
    { language: 'en-gb', enabled: true },
    { language: 'pt-br', enabled: false },
    { language: 'es-419', enabled: false },
  ]
  assert.equal(pickAudioTrack({ audioTracks: tracks }), 'pt-br')
  assert.deepEqual(
    tracks.map((track) => track.enabled),
    [false, true, false],
  )
  assert.equal(pickAudioTrack({ audioTracks: [{ language: 'en-gb', enabled: true }] }), '')
  assert.equal(pickAudioTrack({}), '')
})
