import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { faker } from './factories.mjs'
import { createTvShell } from '../src/tvShell.mjs'

const HLS_TYPE = 'application/vnd.apple.mpegurl'
const plays = []
const pauses = []

const dom = new JSDOM(`<!doctype html><body>
  <section id="player" hidden></section>
  <aside id="pip" hidden></aside>
</body>`)

globalThis.document = dom.window.document
globalThis.window = dom.window
dom.window.HTMLVideoElement.prototype.canPlayType = function canPlayType(type) {
  return type === HLS_TYPE ? 'maybe' : ''
}
Object.defineProperty(dom.window.HTMLVideoElement.prototype, 'paused', {
  configurable: true,
  get() {
    return this._paused !== false
  },
})
function stubVideo() {
  dom.window.HTMLVideoElement.prototype.play = function play() {
    this._paused = false
    plays.push(this.getAttribute('src') || this.src)
    return Promise.resolve()
  }
  dom.window.HTMLVideoElement.prototype.pause = function pause() {
    this._paused = true
    pauses.push(this)
  }
}
stubVideo()

const { state } = await import('../web/state.mjs')
const { renderPlayer, resetPlayerMedia, setHlsEngine } = await import('../web/playerView.mjs')
const { togglePlayerFullscreen } = await import('../web/fullscreen.mjs')
const { hidePlayerHudIfIdle } = await import('../web/playerHud.mjs')
const { favStore, historyStore } = await import('../web/stores.mjs')
const { PRIME_SCREEN_EVENT } = await import('../web/primeVideo.mjs')
const originalFetch = globalThis.fetch

beforeEach(() => {
  faker.seed(61)
  plays.length = 0
  pauses.length = 0
  stubVideo()
  state.redraw = () => {}
  state.shell = createTvShell()
  state.client = null
  state.errorText = ''
  state.epg = { key: '', listings: [] }
  resetPlayerMedia()
  setHlsEngine(null)
  delete globalThis.__TAURI__
  historyStore.clear()
  favStore.clear()
  globalThis.fetch = async () => ({ ok: false, status: 599, text: async () => '' })
})

afterEach(() => {
  resetPlayerMedia()
  globalThis.fetch = originalFetch
})

function liveUrl() {
  return `http://${faker.internet.domainName()}/live/user/pass/1658633.m3u8`
}

function openFla(url = liveUrl()) {
  state.client = { livePlayUrl: () => url, shortEpg: async () => [] }
  state.shell = {
    ...createTvShell(),
    screen: 'player',
    catalogKind: 'live',
    selectedItem: { id: 1658633, name: 'FLA X GRE 19:30 SD' },
  }
  return url
}

test('player esconde os controles nativos e pinta o HUD cinema', () => {
  openFla()
  renderPlayer()
  const video = document.querySelector('#player video')
  const hud = document.querySelector('#player-frame [data-player-hud]')
  const brand = document.querySelector('[data-player-brand]')
  assert.equal(video.controls, false)
  assert.ok(hud)
  assert.ok(document.querySelector('[data-player-pause]'))
  assert.ok(document.querySelector('[data-player-progress]'))
  assert.ok(document.querySelector('[data-player-clock]'))
  assert.equal(brand.textContent.trim(), 'OPENFLIX CINEMA')
  assert.equal(hud.textContent.includes('STREAMFLIX'), false)
  assert.equal(document.querySelector('[data-skip-intro]').hidden, true)
  assert.equal(document.querySelector('[data-next-episode]').hidden, true)
})

test('player de filme mostra pulo de 10s e velocidade', () => {
  const url = `http://${faker.internet.domainName()}/movie/user/pass/9.mp4`
  state.client = { moviePlayUrl: () => url }
  state.shell = {
    ...createTvShell(),
    screen: 'player',
    catalogKind: 'movies',
    selectedItem: { id: 9, name: faker.lorem.words(2), extension: 'mp4' },
  }
  renderPlayer()
  const video = document.querySelector('#player video')
  Object.defineProperty(video, 'duration', { configurable: true, get: () => 3260 })
  video.currentTime = 1725
  video.dispatchEvent(new dom.window.Event('timeupdate'))
  assert.ok(document.querySelector('[data-player-skip="-10"]'))
  assert.ok(document.querySelector('[data-player-skip="10"]'))
  assert.match(document.querySelector('[data-player-rate]').textContent, /1\.0x/)
  assert.match(document.querySelector('[data-player-clock]').textContent, /28:45 \/ 54:20/)
})

test('pulo de 10s avança o currentTime do filme', () => {
  const url = `http://${faker.internet.domainName()}/movie/user/pass/9.mp4`
  state.client = { moviePlayUrl: () => url }
  state.shell = {
    ...createTvShell(),
    screen: 'player',
    catalogKind: 'movies',
    selectedItem: { id: 9, name: faker.lorem.words(2), extension: 'mp4' },
  }
  renderPlayer()
  const video = document.querySelector('#player video')
  Object.defineProperty(video, 'duration', { configurable: true, get: () => 3260 })
  video.currentTime = 1725
  video.dispatchEvent(new dom.window.Event('loadedmetadata'))
  document.querySelector('[data-player-skip="10"]').click()
  assert.equal(video.currentTime, 1735)
})

test('pause do HUD pausa o vídeo', () => {
  openFla()
  renderPlayer()
  const video = document.querySelector('#player video')
  assert.equal(video.paused, false)
  document.querySelector('[data-player-pause]').click()
  assert.equal(video.paused, true)
})

test('player HLS liga autoplay e dispara play', () => {
  const url = openFla()
  renderPlayer()
  const video = document.querySelector('#player video')
  assert.ok(video)
  assert.equal(video.autoplay, true)
  assert.equal(plays.length, 1)
  assert.equal(plays[0], url)
})

test('segundo render com EPG reusa o mesmo video e não chama play de novo', () => {
  const url = openFla()
  renderPlayer()
  const first = document.querySelector('#player video')
  state.epg = {
    key: '1658633',
    listings: [
      {
        title: 'Informações Diárias',
        start: '2026-11-04 00:00:00',
        stop: '2026-11-04 01:00:00',
        hasArchive: false,
      },
    ],
  }
  renderPlayer()
  const second = document.querySelector('#player video')
  assert.equal(second, first)
  assert.equal(plays.length, 1)
  assert.equal(plays[0], url)
  assert.match(document.querySelector('#player').textContent, /Informações Diárias/)
})

test('AbortError do play não mostra player recusou', async () => {
  openFla()
  const abort = new Error('The operation was aborted.')
  abort.name = 'AbortError'
  dom.window.HTMLVideoElement.prototype.play = function play() {
    plays.push('aborted')
    return Promise.reject(abort)
  }
  renderPlayer()
  await Promise.resolve()
  assert.equal(state.errorText, '')
})

test('HUD cinema some no idle e volta pausado ou no mouse', () => {
  openFla()
  renderPlayer()
  const frame = document.querySelector('#player-frame')
  const video = document.querySelector('#player video')
  const overlay = document.querySelector('[data-player-hud]')
  assert.equal(video.paused, false)
  assert.equal(overlay.hasAttribute('data-hud-idle'), false)
  assert.equal(hidePlayerHudIfIdle(frame, video, { idleMs: 2800 }), true)
  assert.equal(overlay.hasAttribute('data-hud-idle'), true)
  assert.equal(hidePlayerHudIfIdle(frame, video, { idleMs: 9000, paused: true }), false)
  assert.equal(overlay.hasAttribute('data-hud-idle'), false)
  hidePlayerHudIfIdle(frame, video, { idleMs: 9000 })
  frame.dispatchEvent(new dom.window.Event('mousemove'))
  assert.equal(overlay.hasAttribute('data-hud-idle'), false)
})

test('player mostra botão Tela cheia no HUD', () => {
  openFla()
  renderPlayer()
  const button = document.querySelector('#player-frame [data-fullscreen]')
  assert.ok(button)
  assert.match(button.textContent, /Tela cheia/)
})

test('player não duplica Favoritar nem Abrir no player abaixo do vídeo', () => {
  globalThis.__TAURI__ = { core: { invoke: async () => {} } }
  openFla()
  renderPlayer()
  assert.equal(document.querySelectorAll('#player > [data-fav]').length, 0)
  assert.equal(document.querySelectorAll('#player > [data-sidecar]').length, 0)
  assert.equal(document.querySelectorAll('#player > button').length, 0)
})

test('no Tauri o quadro tem Abrir no player no topo', () => {
  globalThis.__TAURI__ = { core: { invoke: async () => {} } }
  openFla()
  renderPlayer()
  const button = document.querySelector('#player-frame [data-sidecar]')
  assert.ok(button)
  assert.match(button.textContent, /Abrir no player/)
})

test('player tem atalho Prime Video que leva para a aba Prime', () => {
  const seen = []
  const listener = () => seen.push('prime')
  document.addEventListener(PRIME_SCREEN_EVENT, listener)
  openFla()
  renderPlayer()
  const button = document.querySelector('#player-frame [data-prime-video]')
  assert.ok(button)
  assert.match(button.textContent, /Prime Video/)
  button.click()
  document.removeEventListener(PRIME_SCREEN_EVENT, listener)
  assert.deepEqual(seen, ['prime'])
})

test('F liga o teatro pela API de tela cheia', async () => {
  openFla()
  renderPlayer()
  await togglePlayerFullscreen()
  assert.equal(document.body.classList.contains('is-fullscreen'), true)
})

test('teatro pede setFullscreen na janela Tauri', async () => {
  const calls = []
  let resume
  const done = new Promise((resolve) => {
    resume = resolve
  })
  globalThis.__TAURI__ = {
    window: {
      getCurrentWindow() {
        return {
          async setFullscreen(on) {
            calls.push(on)
            resume()
          },
        }
      },
    },
  }
  openFla()
  renderPlayer()
  void togglePlayerFullscreen()
  await done
  await Promise.resolve()
  assert.deepEqual(calls, [true])
  assert.equal(document.body.classList.contains('is-fullscreen'), true)
})

test('abrir o player grava o canal no histórico', () => {
  openFla()
  renderPlayer()
  const listed = historyStore.list()
  assert.equal(listed.length, 1)
  assert.equal(listed[0].streamId, '1658633')
  assert.equal(listed[0].name, 'FLA X GRE 19:30 SD')
  assert.equal(listed[0].catalogKind, 'live')
})

test('segundo render com o mesmo item não duplica o histórico', () => {
  openFla()
  renderPlayer()
  renderPlayer()
  assert.equal(historyStore.list().length, 1)
})

test('player mostra botão Favoritar', () => {
  openFla()
  renderPlayer()
  const button = document.querySelector('[data-fav]')
  assert.ok(button)
  assert.match(button.textContent, /Favoritar/)
})

test('quadro do player tem o Favoritar na barra acima do vídeo', () => {
  openFla()
  renderPlayer()
  const button = document.querySelector('#player-frame [data-fav]')
  assert.ok(button)
  assert.equal(button.parentElement.className.includes('absolute'), false)
})

test('clicar Favoritar marca o canal e troca o rótulo', () => {
  openFla()
  renderPlayer()
  document.querySelector('[data-fav]').click()
  assert.equal(favStore.isFav('1658633'), true)
  assert.match(document.querySelector('[data-fav]').textContent, /Remover favorito/)
})

test('no Tauri o HLS vai pelo hls.js e não coloca o http no src', () => {
  const url = openFla()
  const loads = []
  class FakeHls {
    static isSupported() {
      return true
    }
    loadSource(href) {
      loads.push(href)
    }
    attachMedia() {}
    destroy() {}
  }
  globalThis.__TAURI__ = { core: { invoke: async () => {} } }
  setHlsEngine(FakeHls)
  renderPlayer()
  const video = document.querySelector('#player video')
  assert.equal(loads[0], url)
  assert.equal(video.getAttribute('src'), null)
  assert.match(document.querySelector('#player').textContent, /fetch do shell/)
})

test('no Tauri o HLS do loopback YouTube usa o player nativo', () => {
  const videoId = faker.string.alphanumeric(11)
  const url = `http://127.0.0.1:${faker.internet.port()}/video/${videoId}.m3u8`
  const loads = []
  class FakeHls {
    static isSupported() {
      return true
    }
    loadSource(href) {
      loads.push(href)
    }
    attachMedia() {}
    destroy() {}
  }
  globalThis.__TAURI__ = { core: { invoke: async () => {} } }
  setHlsEngine(FakeHls)
  state.client = { livePlayUrl: () => `http://${faker.internet.domainName()}/live/x.m3u8` }
  state.shell = {
    ...createTvShell(),
    screen: 'player',
    catalogKind: 'movies',
    selectedItem: { id: videoId, name: faker.lorem.words(3), url },
  }
  renderPlayer()
  const video = document.querySelector('#player video')
  assert.equal(loads.length, 0)
  assert.equal(video.src, url)
  assert.match(document.querySelector('#player').textContent, /HLS nativo/)
})

function leavePlayer(screen = 'home') {
  state.shell = { ...state.shell, screen }
  renderPlayer()
}

test('sair do player tocando coloca o vídeo no PiP sem pausar', () => {
  const url = openFla()
  renderPlayer()
  const video = document.querySelector('#player video')
  leavePlayer()
  assert.equal(pauses.length, 0)
  assert.equal(document.querySelector('#pip video'), video)
  assert.equal(document.getElementById('pip').hidden, false)
  assert.equal(document.getElementById('player').hidden, true)
  assert.equal(video.paused, false)
  assert.equal(plays[0], url)
})

test('PiP tira o vídeo do #player antes de esconder a seção', () => {
  openFla()
  renderPlayer()
  const player = document.getElementById('player')
  const video = player.querySelector('video')
  Object.defineProperty(player, 'hidden', {
    configurable: true,
    get() {
      return player.hasAttribute('hidden')
    },
    set(value) {
      if (value && player.contains(video)) video.pause()
      if (value) player.setAttribute('hidden', '')
      else player.removeAttribute('hidden')
    },
  })
  try {
    leavePlayer()
    assert.equal(pauses.length, 0)
    assert.equal(document.querySelector('#pip video'), video)
    assert.equal(video.paused, false)
  } finally {
    delete player.hidden
  }
})

test('sair do player pausado não abre o PiP', () => {
  openFla()
  renderPlayer()
  const video = document.querySelector('#player video')
  video.pause()
  pauses.length = 0
  leavePlayer()
  assert.equal(document.getElementById('pip').hidden, true)
  assert.equal(document.querySelector('#pip video'), null)
  assert.equal(pauses.length, 1)
})

test('clicar no PiP volta ao player com o mesmo vídeo', () => {
  openFla()
  renderPlayer()
  const video = document.querySelector('#player video')
  state.redraw = renderPlayer
  leavePlayer()
  document.getElementById('pip').click()
  assert.equal(state.shell.screen, 'player')
  assert.equal(state.shell.selectedItem.id, 1658633)
  assert.equal(document.querySelector('#player video'), video)
  assert.equal(document.getElementById('pip').hidden, true)
  assert.equal(document.getElementById('player').hidden, false)
})

test('clicar no PiP depois da home zerada restaura o item que estava tocando', () => {
  openFla()
  renderPlayer()
  const video = document.querySelector('#player video')
  state.redraw = renderPlayer
  state.shell = createTvShell()
  renderPlayer()
  document.getElementById('pip').click()
  assert.equal(state.shell.screen, 'player')
  assert.equal(state.shell.catalogKind, 'live')
  assert.equal(state.shell.selectedItem.id, 1658633)
  assert.equal(document.querySelector('#player video'), video)
})

test('dar play em outro item fecha o PiP e troca o stream', () => {
  openFla()
  renderPlayer()
  const video = document.querySelector('#player video')
  leavePlayer()
  assert.equal(document.getElementById('pip').hidden, false)
  assert.equal(document.querySelector('#pip video'), video)
  const otherUrl = `http://${faker.internet.domainName()}/live/user/pass/42.m3u8`
  state.client = { livePlayUrl: () => otherUrl, shortEpg: async () => [] }
  state.shell = {
    ...createTvShell(),
    screen: 'player',
    catalogKind: 'live',
    selectedItem: { id: 42, name: faker.lorem.words(2) },
  }
  renderPlayer()
  assert.equal(document.getElementById('pip').hidden, true)
  assert.equal(document.querySelector('#player video'), video)
  assert.equal(plays.at(-1), otherUrl)
})

test('player ao vivo tem Ir ao vivo no HUD', () => {
  openFla()
  renderPlayer()
  const button = document.querySelector('#player-frame [data-go-live]')
  assert.ok(button)
  assert.match(button.textContent, /Ir ao vivo/)
})

test('player de filme não mostra Ir ao vivo', () => {
  const url = `http://${faker.internet.domainName()}/movie/user/pass/9.mp4`
  state.client = { moviePlayUrl: () => url }
  state.shell = {
    ...createTvShell(),
    screen: 'player',
    catalogKind: 'movies',
    selectedItem: { id: 9, name: faker.lorem.words(2), extension: 'mp4' },
  }
  renderPlayer()
  assert.equal(document.querySelector('[data-go-live]'), null)
})

test('clicar Ir ao vivo pula o HLS para liveSyncPosition', () => {
  openFla()
  const edge = faker.number.float({ min: 40, max: 90, fractionDigits: 1 })
  class FakeHls {
    static isSupported() {
      return true
    }
    get liveSyncPosition() {
      return edge
    }
    loadSource() {}
    attachMedia() {}
    destroy() {}
  }
  globalThis.__TAURI__ = { core: { invoke: async () => {} } }
  setHlsEngine(FakeHls)
  renderPlayer()
  const video = document.querySelector('#player video')
  video.currentTime = 1
  document.querySelector('[data-go-live]').click()
  assert.equal(video.currentTime, edge)
})

test('sair em tela cheia tocando sai do teatro e deixa o PiP', async () => {
  openFla()
  renderPlayer()
  await togglePlayerFullscreen()
  leavePlayer()
  assert.equal(document.body.classList.contains('is-fullscreen'), false)
  assert.equal(document.getElementById('pip').hidden, false)
  assert.ok(document.querySelector('#pip video'))
})

function youtubeHlsFixture() {
  const videoId = faker.string.alphanumeric(11)
  const port = faker.internet.port()
  const master = `http://127.0.0.1:${port}/video/${videoId}.m3u8`
  const levels = {
    hd: `http://127.0.0.1:${port}/ytg?u=${faker.string.alphanumeric(8)}`,
    hd720: `http://127.0.0.1:${port}/ytg?u=${faker.string.alphanumeric(8)}`,
    p480: `http://127.0.0.1:${port}/ytg?u=${faker.string.alphanumeric(8)}`,
    p360: `http://127.0.0.1:${port}/ytg?u=${faker.string.alphanumeric(8)}`,
    p240: `http://127.0.0.1:${port}/ytg?u=${faker.string.alphanumeric(8)}`,
    p144: `http://127.0.0.1:${port}/ytg?u=${faker.string.alphanumeric(8)}`,
  }
  const body = [
    '#EXTM3U',
    '#EXT-X-INDEPENDENT-SEGMENTS',
    '#EXT-X-STREAM-INF:BANDWIDTH=5552610,RESOLUTION=1920x1080,FRAME-RATE=60',
    levels.hd,
    '#EXT-X-STREAM-INF:BANDWIDTH=2892080,RESOLUTION=1280x720,FRAME-RATE=60',
    levels.hd720,
    '#EXT-X-STREAM-INF:BANDWIDTH=1391960,RESOLUTION=854x480,FRAME-RATE=30',
    levels.p480,
    '#EXT-X-STREAM-INF:BANDWIDTH=962461,RESOLUTION=640x360,FRAME-RATE=30',
    levels.p360,
    '#EXT-X-STREAM-INF:BANDWIDTH=480000,RESOLUTION=426x240,FRAME-RATE=30',
    levels.p240,
    '#EXT-X-STREAM-INF:BANDWIDTH=269034,RESOLUTION=256x144,FRAME-RATE=30',
    levels.p144,
  ].join('\n')
  return { videoId, master, levels, body }
}

function openYoutubeHls(url) {
  const videoId = faker.string.alphanumeric(11)
  globalThis.__TAURI__ = { core: { invoke: async () => {} } }
  state.client = { livePlayUrl: () => `http://${faker.internet.domainName()}/live/x.m3u8` }
  state.shell = {
    ...createTvShell(),
    screen: 'player',
    catalogKind: 'movies',
    selectedItem: { id: videoId, name: faker.lorem.words(3), url },
  }
  return videoId
}

function stubMasterFetch(master, body) {
  globalThis.fetch = async (requested) => {
    if (String(requested) === master) {
      return { ok: true, status: 200, text: async () => body }
    }
    return { ok: false, status: 404, text: async () => '' }
  }
}

async function whenQualityButton() {
  for (let i = 0; i < 40; i += 1) {
    const button = document.querySelector('[data-quality]')
    if (button) return button
    await Promise.resolve()
  }
  return document.querySelector('[data-quality]')
}

test('HLS do YouTube com vários STREAM-INF mostra Qualidade', async () => {
  const { master, body } = youtubeHlsFixture()
  stubMasterFetch(master, body)
  openYoutubeHls(master)
  renderPlayer()
  const button = await whenQualityButton()
  assert.ok(button)
  assert.match(button.textContent, /Qualidade/)
})

test('painel Qualidade lista os níveis do YouTube e Automático', async () => {
  const { master, body } = youtubeHlsFixture()
  stubMasterFetch(master, body)
  openYoutubeHls(master)
  renderPlayer()
  const button = await whenQualityButton()
  button.click()
  const panel = document.querySelector('[data-quality-panel]')
  assert.ok(panel)
  const labels = [...panel.querySelectorAll('[data-quality-option]')].map((node) =>
    node.textContent.replace('✓', '').trim(),
  )
  assert.deepEqual(labels, ['1080p60 HD', '720p60', '480p', '360p', '240p', '144p', 'Automático'])
})

test('escolher 1080p60 HD troca o src do vídeo para o variant', async () => {
  const { master, body, levels } = youtubeHlsFixture()
  stubMasterFetch(master, body)
  openYoutubeHls(master)
  renderPlayer()
  const button = await whenQualityButton()
  button.click()
  document.querySelector('[data-quality-option="1080p60"]').click()
  const video = document.querySelector('#player video')
  assert.equal(video.src, levels.hd)
  assert.equal(document.querySelector('[data-quality-panel]'), null)
})

test('Automático restaura o master HLS', async () => {
  const { master, body, levels } = youtubeHlsFixture()
  stubMasterFetch(master, body)
  openYoutubeHls(master)
  renderPlayer()
  const button = await whenQualityButton()
  button.click()
  document.querySelector('[data-quality-option="1080p60"]').click()
  assert.equal(document.querySelector('#player video').src, levels.hd)
  document.querySelector('[data-quality]').click()
  document.querySelector('[data-quality-option="auto"]').click()
  assert.equal(document.querySelector('#player video').src, master)
})

test('Qualidade no loopback usa o fetch da página se o HTTP do Tauri falha', async () => {
  const { master, body } = youtubeHlsFixture()
  stubMasterFetch(master, body)
  openYoutubeHls(master)
  globalThis.__TAURI__.http = {
    fetch: async () => ({ ok: false, status: 599, text: async () => '' }),
  }
  renderPlayer()
  const button = await whenQualityButton()
  assert.ok(button)
  assert.match(button.textContent, /Qualidade/)
})

test('filme progressivo não mostra Qualidade', () => {
  const url = `http://${faker.internet.domainName()}/movie/user/pass/9.mp4`
  state.client = { moviePlayUrl: () => url }
  state.shell = {
    ...createTvShell(),
    screen: 'player',
    catalogKind: 'movies',
    selectedItem: { id: 9, name: faker.lorem.words(2), extension: 'mp4' },
  }
  renderPlayer()
  assert.equal(document.querySelector('[data-quality]'), null)
})

test('closePlayerQuality fecha o painel e devolve true', async () => {
  const { master, body } = youtubeHlsFixture()
  stubMasterFetch(master, body)
  openYoutubeHls(master)
  renderPlayer()
  const button = await whenQualityButton()
  button.click()
  assert.ok(document.querySelector('[data-quality-panel]'))
  const { closePlayerQuality } = await import('../web/playerView.mjs')
  assert.equal(typeof closePlayerQuality, 'function')
  assert.equal(closePlayerQuality(), true)
  assert.equal(document.querySelector('[data-quality-panel]'), null)
  assert.equal(closePlayerQuality(), false)
})
