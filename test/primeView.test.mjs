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
const { renderPrime } = await import('../web/primeView.mjs')

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
    ['home:home', 'genre:av_genre_action', 'merch:mgForYou', 'home:store'],
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
  document.getElementById('primeDetailClose').click()
  assert.equal(document.getElementById('primeDetail'), null)
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
