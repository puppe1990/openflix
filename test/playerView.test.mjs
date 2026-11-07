import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
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
const { favStore, historyStore } = await import('../web/stores.mjs')
const { PRIME_SCREEN_EVENT } = await import('../web/primeVideo.mjs')

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

test('player não mostra botão Tela cheia', () => {
  openFla()
  renderPlayer()
  assert.equal(document.querySelector('[data-fullscreen]'), null)
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
  assert.equal(button.className.includes('ml-auto'), true)
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

test('player ao vivo tem Ir ao vivo como primeiro controle da barra', () => {
  openFla()
  renderPlayer()
  const toolbar = document.querySelector('[data-player-toolbar]')
  const button = toolbar.querySelector('[data-go-live]')
  assert.ok(button)
  assert.match(button.textContent, /Ir ao vivo/)
  assert.equal(toolbar.firstElementChild, button)
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
