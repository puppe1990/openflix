import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { faker } from './factories.mjs'

const dom = new JSDOM(`<!doctype html><body>
  <div id="screen-spinner" hidden role="status" aria-live="polite" aria-busy="false">
    <p id="screen-spinner-label"></p>
  </div>
</body>`)

globalThis.document = dom.window.document

const { state } = await import('../web/state.mjs')
const { renderSpinner } = await import('../web/spinnerView.mjs')

beforeEach(() => {
  faker.seed(105)
  state.spinner = { busy: false, label: '', startedAt: 0 }
  renderSpinner()
})

test('spinner oculto quando a troca acabou', () => {
  const root = document.getElementById('screen-spinner')
  assert.equal(root.hidden, true)
  assert.equal(root.getAttribute('aria-busy'), 'false')
  assert.equal(document.getElementById('screen-spinner-label').textContent, '')
})

test('spinner cobre a tela com o rótulo da transição', () => {
  const label = faker.helpers.arrayElement(['Abrindo ao vivo…', 'Abrindo filmes…'])
  state.spinner = { busy: true, label, startedAt: Date.now() }
  renderSpinner()
  const root = document.getElementById('screen-spinner')
  assert.equal(root.hidden, false)
  assert.equal(root.getAttribute('aria-busy'), 'true')
  assert.equal(document.getElementById('screen-spinner-label').textContent, label)
})
