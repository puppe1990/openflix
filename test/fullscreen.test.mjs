import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { fullscreenButtonLabel, shouldConsumeEscape } from '../src/fullscreen.mjs'

function afterBaseLayer(source) {
  const start = source.indexOf('@layer base')
  if (start < 0) return source
  let depth = 0
  for (let i = source.indexOf('{', start); i < source.length; i += 1) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(i + 1)
    }
  }
  return source
}

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../web/input.css'), 'utf8')
const unlayered = afterBaseLayer(css)

test('rótulo entra e sai da tela cheia', () => {
  assert.equal(fullscreenButtonLabel(false), 'Tela cheia')
  assert.equal(fullscreenButtonLabel(true), 'Sair da tela cheia')
})

test('rótulo recusa valor que não é boolean', () => {
  assert.throws(() => fullscreenButtonLabel('sim'), /boolean/)
})

test('Esc no player fullscreen não volta pro catálogo', () => {
  assert.equal(shouldConsumeEscape(true), true)
  assert.equal(shouldConsumeEscape(false), false)
})

test('teatro fora do @layer esconde URL/nota e enche o quadro', () => {
  const maxHeightAt = unlayered.indexOf('#player:not([hidden]) #player-frame')
  const hideAt = unlayered.indexOf('body.is-fullscreen #player > :not(#player-frame)')
  const fillAt = unlayered.indexOf('body.is-fullscreen #player:not([hidden]) #player-frame')
  assert.ok(maxHeightAt >= 0, 'max-height do quadro windowed')
  assert.ok(hideAt > maxHeightAt, 'esconder irmãos precisa ganhar da max-height')
  assert.ok(fillAt > maxHeightAt, 'encher o quadro precisa ganhar da max-height')
  assert.match(unlayered.slice(hideAt, hideAt + 160), /display:\s*none\s*!important/)
  assert.match(unlayered.slice(fillAt, fillAt + 220), /max-height:\s*none/)
})
