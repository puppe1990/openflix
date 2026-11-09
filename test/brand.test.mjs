import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import { BRAND, STORAGE_PREFIX } from '../web/config.mjs'

test('marca visível é OpenFlix e as chaves de storage continuam life-tv', () => {
  assert.equal(BRAND, 'OpenFlix')
  assert.equal(STORAGE_PREFIX, 'life-tv')
})

test('janela e bundle se chamam OpenFlix sem mudar o identifier', async () => {
  const conf = JSON.parse(
    await readFile(new URL('../src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  )
  assert.equal(conf.productName, 'OpenFlix')
  assert.equal(conf.app.windows[0].title, 'OpenFlix')
  assert.equal(conf.identifier, 'com.life-tv.app')
})

test('cabeçalho e título HTML usam OpenFlix', async () => {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8')
  assert.match(html, /<title>OpenFlix<\/title>/)
  assert.match(html, /id="brand"[^>]*>OpenFlix</)
  assert.doesNotMatch(html, />Life TV</)
})

test('cabeçalho troca o hint de teclado por botão claro/escuro', async () => {
  const html = await readFile(new URL('../web/index.html', import.meta.url), 'utf8')
  assert.doesNotMatch(html, /Enter · Esc/)
  assert.doesNotMatch(html, /id="hint"/)
  assert.match(html, /id="theme"/)
  assert.match(html, /data-theme-toggle/)
})

test('build copia o binário do Cargo, não o slug do productName', async () => {
  const script = await readFile(new URL('../scripts/build-macos-app.sh', import.meta.url), 'utf8')
  assert.match(script, /Cargo\.toml/)
  assert.match(script, /readFileSync/)
  assert.doesNotMatch(script, /productName\.toLowerCase\(\)/)
})
