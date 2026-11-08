import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createTvShell } from '../src/tvShell.mjs'
import { createPrimeFocus } from '../src/primeFocus.mjs'
import { faker, fakerPrimeEntity, fakerPrimeLanding, fakerPrimeNav } from './factories.mjs'

faker.seed(20261107)

const dom = new JSDOM('<!doctype html><body><section id="prime" hidden></section></body>')

globalThis.document = dom.window.document
globalThis.window = dom.window

const { parseEnrichNav } = await import('../src/primeNav.mjs')
const { parseLanding } = await import('../src/primeLanding.mjs')
const { emptyPrime, state } = await import('../web/state.mjs')
const { handlePrimeKey, renderPrime } = await import('../web/primeView.mjs')
const { PANE_HOST_ID } = await import('../web/primePane.mjs')

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

function stubPaneHostRect({ left = 40, top = 80, width = 1200, height = 675 } = {}) {
  Object.defineProperty(globalThis, 'innerWidth', { configurable: true, value: 1600 })
  Object.defineProperty(globalThis, 'innerHeight', { configurable: true, value: 900 })
  globalThis.window.HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    if (this.id === PANE_HOST_ID) {
      return {
        x: left,
        y: top,
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
      }
    }
    return { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }
  }
}

beforeEach(() => {
  faker.seed(20261107)
  state.redraw = renderPrime
  state.errorText = ''
  state.shell = { ...createTvShell(), screen: 'prime' }
  state.prime = emptyPrime()
  state.prime.dests = parseEnrichNav(fakerPrimeNav())
  state.prime.destKey = 'merch:mgForYou'
  state.prime.rows = parseLanding(
    fakerPrimeLanding({
      containers: [
        {
          containerType: 'StandardCarousel',
          title: 'Suspense psicológico',
          entities: [fakerPrimeEntity({ title: 'Breakdown' })],
        },
      ],
    }),
  ).rows
  state.prime.focus = createPrimeFocus()
})

test('tela Prime lista o trilho nativo e as fileiras, sem palco de webview', () => {
  renderPrime()
  const root = document.getElementById('prime')
  assert.equal(root.hidden, false)
  const dests = [...root.querySelectorAll('[data-prime-dest]')]
  assert.deepEqual(
    dests.map((node) => node.dataset.primeDest),
    ['home:home', 'home:Sports', 'genre:av_genre_action', 'merch:mgForYou', 'home:store'],
  )
  assert.match(root.textContent, /Feito para você/)
  assert.match(root.textContent, /Suspense psicológico/)
  assert.match(root.textContent, /Breakdown/)
  assert.equal(document.getElementById('primeStage'), null)
  const active = dests.find((node) => node.dataset.primeDest === 'merch:mgForYou')
  assert.match(active.className, /bg-accent/)
})

test('card abre o detalhe; Escape some o overlay', () => {
  renderPrime()
  document.querySelector('[data-prime-card]').click()
  const overlay = document.getElementById('primeDetail')
  assert.ok(overlay)
  assert.match(overlay.textContent, /Breakdown/)
  assert.match(document.getElementById('primeDetailPlay').textContent, /Assistir/)
  assert.match(document.getElementById('primeDetailBrowser').textContent, /navegador/i)
  document.getElementById('primeDetailClose').click()
  assert.equal(document.getElementById('primeDetail'), null)
})

test('aba Prime tem entrada para a janela oficial no cabeçalho', () => {
  renderPrime()
  assert.match(document.getElementById('primeOpenBtn').textContent, /Abrir Prime Video/)
})

test('emptyPrime começa sem painel e o palco só aparece com título tocando', () => {
  assert.deepEqual(emptyPrime().pane, { url: null, title: '' })
  renderPrime()
  assert.equal(document.getElementById(PANE_HOST_ID), null)
  state.prime.pane = {
    url: 'https://www.primevideo.com/detail/amzn1.dv.gti.x',
    title: 'Breakdown',
  }
  renderPrime()
  assert.ok(document.getElementById(PANE_HOST_ID))
  assert.match(document.getElementById('primePaneClose').textContent, /Fechar/)
  assert.match(document.getElementById('prime').textContent, /Breakdown/)
  assert.equal(document.querySelector('[data-prime-card]'), null)
})

test('Assistir dispara prime_pane_open sobre o palco da UI', async () => {
  stubPaneHostRect()
  const calls = []
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        calls.push({ command, args })
      },
    },
  }
  try {
    renderPrime()
    document.querySelector('[data-prime-card]').click()
    document.getElementById('primeDetailPlay').click()
    await tick()
  } finally {
    delete globalThis.__TAURI__
  }
  const opened = calls.find((call) => call.command === 'prime_pane_open')
  assert.ok(opened)
  assert.match(opened.args.url, /^https:\/\/www\.primevideo\.com\/-\/pt\/detail\//)
  assert.equal(opened.args.x, 40)
  assert.equal(opened.args.y, 80)
  assert.equal(opened.args.width, 1200)
  assert.equal(opened.args.height, 675)
  assert.ok(document.getElementById(PANE_HOST_ID))
  assert.equal(document.getElementById('primeDetail'), null)
})

test('Fechar player e Escape fecham o palco; sair da aba só esconde', async () => {
  stubPaneHostRect()
  const calls = []
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        calls.push({ command, args })
      },
    },
  }
  try {
    state.prime.pane = {
      url: 'https://www.primevideo.com/detail/amzn1.dv.gti.x',
      title: 'Breakdown',
    }
    renderPrime()
    calls.length = 0
    document.getElementById('primePaneClose').click()
    await tick()
    assert.ok(calls.some((call) => call.command === 'prime_pane_close'))
    assert.equal(document.getElementById(PANE_HOST_ID), null)
    assert.equal(state.prime.pane.url, null)

    state.prime.pane = {
      url: 'https://www.primevideo.com/detail/amzn1.dv.gti.x',
      title: 'Breakdown',
    }
    renderPrime()
    calls.length = 0
    assert.equal(handlePrimeKey('Escape'), true)
    await tick()
    assert.ok(calls.some((call) => call.command === 'prime_pane_close'))
    assert.equal(state.prime.pane.url, null)

    state.prime.pane = {
      url: 'https://www.primevideo.com/detail/amzn1.dv.gti.x',
      title: 'Breakdown',
    }
    state.shell = { ...createTvShell(), screen: 'home' }
    calls.length = 0
    renderPrime()
    await tick()
    assert.ok(calls.some((call) => call.command === 'prime_pane_hide'))
    assert.equal(state.prime.pane.url, 'https://www.primevideo.com/detail/amzn1.dv.gti.x')
  } finally {
    delete globalThis.__TAURI__
  }
})

test('tela Prime fica oculta fora da aba', () => {
  state.shell = { ...createTvShell(), screen: 'home' }
  renderPrime()
  assert.equal(document.getElementById('prime').hidden, true)
})

test('fileiras vazias com erro não ficam em Carregando', () => {
  state.prime.rows = []
  state.errorText = 'prime video recusou: recebido HTTP 403, esperado 2xx'
  renderPrime()
  const root = document.getElementById('prime')
  assert.doesNotMatch(root.textContent, /Carregando o catálogo/)
  assert.match(root.textContent, /Não deu para carregar o catálogo/)
})
