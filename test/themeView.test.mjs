import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createJsonBucket } from '../src/jsonBucket.mjs'
import { createThemeStore } from '../src/theme.mjs'
import { faker } from './factories.mjs'

beforeEach(() => {
  faker.seed(92)
})

function mount() {
  const dom = new JSDOM(
    '<!doctype html><html><body><button id="theme" type="button"></button></body></html>',
  )
  globalThis.document = dom.window.document
  globalThis.window = dom.window
  return dom
}

test('applyThemeDocument grava data-theme no html', async () => {
  mount()
  const { applyThemeDocument } = await import('../web/themeView.mjs')
  applyThemeDocument(document.documentElement, 'light')
  assert.equal(document.documentElement.dataset.theme, 'light')
  assert.equal(document.documentElement.style.colorScheme, 'light')
})

test('clique no botão de tema troca dark por light', async () => {
  mount()
  const { wireThemeToggle } = await import('../web/themeView.mjs')
  const store = createThemeStore({
    bucket: createJsonBucket({ storage: null, key: 'life-tv:theme' }),
  })
  wireThemeToggle({
    store,
    button: document.getElementById('theme'),
    root: document.documentElement,
  })
  assert.equal(document.documentElement.dataset.theme, 'dark')
  assert.equal(document.getElementById('theme').getAttribute('aria-label'), 'Modo claro')
  document.getElementById('theme').click()
  assert.equal(document.documentElement.dataset.theme, 'light')
  assert.equal(document.getElementById('theme').getAttribute('aria-label'), 'Modo escuro')
  assert.ok(document.querySelector('#theme svg'))
})
