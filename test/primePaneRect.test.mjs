import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PANE_MIN_HEIGHT, PANE_MIN_WIDTH, paneRect } from '../src/primePaneRect.mjs'
import { faker } from './factories.mjs'

faker.seed(20261107)

const VIEWPORT = { width: 1600, height: 900 }

function host(left, top, width, height) {
  return { left, top, width, height, right: left + width, bottom: top + height }
}

test('placeholder inteiro dentro da janela vira o retângulo do painel', () => {
  assert.deepEqual(paneRect(host(240, 80, 960, 540), VIEWPORT), {
    x: 240,
    y: 80,
    width: 960,
    height: 540,
  })
})

test('placeholder que transborda é recortado para a borda da janela', () => {
  assert.deepEqual(paneRect(host(1000, 400, 960, 540), VIEWPORT), {
    x: 1000,
    y: 400,
    width: 600,
    height: 500,
  })
})

test('placeholder com origem negativa é recortado para zero', () => {
  assert.deepEqual(paneRect(host(-100, -50, 960, 540), VIEWPORT), {
    x: 0,
    y: 0,
    width: 860,
    height: 490,
  })
})

test('placeholder oculto (DOM devolve tudo zero) esconde o painel', () => {
  assert.equal(paneRect(host(0, 0, 0, 0), VIEWPORT), null)
})

test('sobra menor que o mínimo do player oficial esconde o painel', () => {
  assert.equal(paneRect(host(1400, 0, 960, 540), VIEWPORT), null)
  assert.equal(paneRect(host(0, 0, PANE_MIN_WIDTH - 1, PANE_MIN_HEIGHT), VIEWPORT), null)
  assert.deepEqual(paneRect(host(0, 0, PANE_MIN_WIDTH, PANE_MIN_HEIGHT), VIEWPORT), {
    x: 0,
    y: 0,
    width: PANE_MIN_WIDTH,
    height: PANE_MIN_HEIGHT,
  })
})

test('aceita retângulo sem right/bottom, que é o caso do rect calculado', () => {
  assert.deepEqual(paneRect({ left: 10, top: 20, width: 800, height: 450 }, VIEWPORT), {
    x: 10,
    y: 20,
    width: 800,
    height: 450,
  })
})

test('medida não finita ou janela zerada não vira retângulo', () => {
  assert.equal(paneRect(host(Number.NaN, 0, 960, 540), VIEWPORT), null)
  assert.equal(paneRect(host(0, 0, Number.POSITIVE_INFINITY, 540), VIEWPORT), null)
  assert.equal(paneRect(host(0, 0, 960, 540), { width: 0, height: 900 }), null)
  assert.equal(paneRect(null, VIEWPORT), null)
  assert.equal(paneRect(host(0, 0, 960, 540), null), null)
})

test('fracionário arredonda para px inteiro, que é o que o webview filho posiciona', () => {
  assert.deepEqual(paneRect(host(10.4, 20.6, 800.5, 450.2), VIEWPORT), {
    x: 10,
    y: 21,
    width: 801,
    height: 450,
  })
})

test('nenhum placeholder aleatório produz painel fora da janela', () => {
  for (let index = 0; index < 60; index += 1) {
    const left = faker.number.int({ min: -200, max: 1800 })
    const top = faker.number.int({ min: -200, max: 1100 })
    const width = faker.number.int({ min: PANE_MIN_WIDTH, max: 2400 })
    const height = faker.number.int({ min: PANE_MIN_HEIGHT, max: 1600 })
    const rect = paneRect(host(left, top, width, height), VIEWPORT)
    if (!rect) continue
    const shown = JSON.stringify(rect)
    assert.ok(rect.x >= 0 && rect.y >= 0, `origem negativa: ${shown}`)
    assert.ok(rect.x + rect.width <= VIEWPORT.width, `estouro horizontal: ${shown}`)
    assert.ok(rect.y + rect.height <= VIEWPORT.height, `estouro vertical: ${shown}`)
    assert.ok(rect.width >= PANE_MIN_WIDTH, `largura abaixo do mínimo: ${shown}`)
    assert.ok(rect.height >= PANE_MIN_HEIGHT, `altura abaixo do mínimo: ${shown}`)
  }
})
