import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { fakerPrimeLanding, fakerPrimeNav } from './factories.mjs'

const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8')

function mountApp() {
  const dom = new JSDOM(html, { url: 'http://localhost/' })
  globalThis.document = dom.window.document
  globalThis.window = dom.window
  globalThis.localStorage = dom.window.localStorage
  return dom
}

function settle(ms = 120) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

beforeEach(() => {
  mountApp()
  globalThis.fetch = async (url) => {
    if (String(url).includes('enrichNav')) {
      return { ok: true, json: async () => fakerPrimeNav() }
    }
    if (String(url).includes('getLandingPage')) {
      return { ok: true, json: async () => fakerPrimeLanding() }
    }
    throw new Error(`fetch inesperado: ${url}`)
  }
})

test('boot em demo desenha a home e as abas', async () => {
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  const tiles = document.querySelectorAll('#home [data-tile]')
  assert.equal(tiles.length, 4)
  assert.match(document.getElementById('tab-inicio').className, /font-bold/)
})

test('clicar na aba Live TV abre o catálogo com itens', async () => {
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-live').click()
  await settle()
  assert.equal(document.getElementById('catalog').hidden, false)
  assert.ok(document.querySelectorAll('#categories li').length >= 1)
  assert.ok(document.querySelectorAll('#items li').length >= 1)
  assert.match(document.getElementById('tab-live').className, /font-bold/)
})

test('trocar de tela mostra o spinner e some depois', async () => {
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-live').click()
  const overlay = document.getElementById('screen-spinner')
  assert.equal(overlay.hidden, false)
  assert.match(document.getElementById('screen-spinner-label').textContent, /ao vivo/i)
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await settle(SPINNER_MIN_MS + 80)
  assert.equal(overlay.hidden, true)
})

test('clicar no tile Ao vivo também abre o catálogo', async () => {
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.querySelector('#home [data-tile="live"]').click()
  await settle()
  assert.equal(document.getElementById('catalog').hidden, false)
})

test('aba Início conserva o catálogo ao vivo já carregado', async () => {
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-live').click()
  await settle()
  const { state } = await import('../web/state.mjs')
  const catalog = state.shell.catalog
  assert.ok(catalog)
  document.getElementById('tab-inicio').click()
  await settle()
  assert.equal(state.shell.screen, 'home')
  assert.equal(state.shell.catalog, catalog)
})

test('Ajustes abre na aba Playlists com Streaming, Prime Video e YouTube ao lado', async () => {
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-settings').click()
  await settle(SPINNER_MIN_MS + 80)
  const labels = [...document.querySelectorAll('#settingsTabs [data-settings-tab]')].map((tab) =>
    tab.textContent.trim(),
  )
  assert.deepEqual(labels, ['Playlists', 'Streaming', 'Prime Video', 'YouTube'])
  assert.equal(document.getElementById('settings-pane-playlists').hidden, false)
  assert.equal(document.getElementById('settings-pane-streaming').hidden, true)
  assert.equal(document.getElementById('settings-pane-prime').hidden, true)
  assert.equal(document.getElementById('settings-pane-youtube').hidden, true)
  assert.equal(document.getElementById('settingsLists').hidden, false)
})

test('Ajustes troca Playlists, Streaming e Prime Video sem sair da tela', async () => {
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-settings').click()
  await settle(SPINNER_MIN_MS + 80)
  document.getElementById('settings-tab-streaming').click()
  assert.equal(document.getElementById('settings-pane-streaming').hidden, false)
  assert.equal(document.getElementById('settings-pane-playlists').hidden, true)
  assert.equal(document.getElementById('settingsLists').hidden, false)
  document.getElementById('settings-tab-prime').click()
  assert.equal(document.getElementById('settings-pane-prime').hidden, false)
  assert.equal(document.getElementById('settings-pane-streaming').hidden, true)
  assert.equal(document.getElementById('settingsLists').hidden, true)
})

test('Ajustes → Prime Video oferece login oficial, sessão do app e sair', async () => {
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-settings').click()
  await settle(SPINNER_MIN_MS + 80)
  document.getElementById('settings-tab-prime').click()
  assert.match(document.getElementById('primeSignInBtn').textContent, /Entrar no Prime Video/)
  assert.match(document.getElementById('primeSyncBtn').textContent, /sessão/i)
  assert.match(document.getElementById('primeSignOutBtn').textContent, /Sair/i)
})

test('Ajustes leva para a aba Prime Video nativa', async () => {
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-settings').click()
  await settle(SPINNER_MIN_MS + 80)
  document.getElementById('settings-tab-prime').click()
  document.getElementById('primeBtn').click()
  await settle(SPINNER_MIN_MS + 80)
  assert.equal(document.getElementById('prime').hidden, false)
  assert.equal(document.getElementById('primeStage'), null)
  assert.ok(document.querySelector('#prime [data-prime-dest]'))
})

test('aba Prime Video lista destinos do enrichNav e destaca o escolhido', async () => {
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-prime').click()
  await settle(SPINNER_MIN_MS + 80)
  const root = document.getElementById('prime')
  assert.equal(root.hidden, false)
  const dests = [...document.querySelectorAll('#prime [data-prime-dest]')]
  assert.ok(dests.length >= 2)
  assert.ok(document.querySelector('#prime [data-prime-dest="home:Sports"]'))
  document.querySelector('#prime [data-prime-dest="merch:mgForYou"]').click()
  await settle(SPINNER_MIN_MS + 80)
  const chosen = document.querySelector('#prime [data-prime-dest="merch:mgForYou"]')
  assert.match(chosen.className, /bg-accent/)
})

test('Ajustes → YouTube oferece login oficial, sessão do app e sair', async () => {
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-settings').click()
  await settle(SPINNER_MIN_MS + 80)
  document.getElementById('settings-tab-youtube').click()
  assert.equal(document.getElementById('settings-pane-youtube').hidden, false)
  assert.equal(document.getElementById('settingsLists').hidden, true)
  assert.match(document.getElementById('youtubeSignInBtn').textContent, /Entrar no YouTube/)
  assert.match(document.getElementById('youtubeSyncBtn').textContent, /sessão/i)
  assert.match(document.getElementById('youtubeSignOutBtn').textContent, /Sair/i)
})

test('Ajustes esconde Playlists salvas quando não há lista', async () => {
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-settings').click()
  await settle(SPINNER_MIN_MS + 80)
  const wrap = document.getElementById('savedPlaylistsWrap')
  assert.ok(wrap)
  assert.equal(wrap.hidden, document.querySelectorAll('#savedPlaylists button').length === 0)
})

test('aba YouTube mostra o trilho chrome mesmo no preview sem Tauri', async () => {
  const { SPINNER_MIN_MS } = await import('../src/screenSpinner.mjs')
  await import(`../web/app.js?t=${Date.now()}`)
  await settle()
  document.getElementById('tab-youtube').click()
  await settle(SPINNER_MIN_MS + 80)
  const root = document.getElementById('youtube')
  assert.equal(root.hidden, false)
  const dests = [...document.querySelectorAll('#youtube [data-youtube-dest]')]
  assert.deepEqual(
    dests.map((node) => node.dataset.youtubeDest),
    ['FEwhat_to_watch', 'FEsubscriptions', 'FEhistory', 'FElibrary'],
  )
  assert.match(document.getElementById('error').textContent, /youtube recusou/)
})
