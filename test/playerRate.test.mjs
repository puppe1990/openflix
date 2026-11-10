import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'

beforeEach(() => {
  faker.seed(91)
})

const { parsePlaybackRate, PLAYER_RATE_MAX, PLAYER_RATE_MIN, rateMenuOptions } =
  await import('../src/playerRate.mjs')

test('parsePlaybackRate aceita 1,5 1.5x e número', () => {
  assert.equal(parsePlaybackRate('1,5'), 1.5)
  assert.equal(parsePlaybackRate('1.5x'), 1.5)
  assert.equal(parsePlaybackRate(' 2 '), 2)
  assert.equal(parsePlaybackRate(0.75), 0.75)
})

test('parsePlaybackRate prende no intervalo 0.25..4', () => {
  assert.equal(PLAYER_RATE_MIN, 0.25)
  assert.equal(PLAYER_RATE_MAX, 4)
  assert.equal(parsePlaybackRate('0.25'), 0.25)
  assert.equal(parsePlaybackRate('4'), 4)
})

test('parsePlaybackRate recusa vazio, zero e fora da faixa', () => {
  const word = faker.lorem.word()
  assert.throws(
    () => parsePlaybackRate(''),
    /velocidade recusada: recebido "", esperado 0\.25\.\.4/,
  )
  assert.throws(
    () => parsePlaybackRate('0'),
    /velocidade recusada: recebido "0", esperado 0\.25\.\.4/,
  )
  assert.throws(
    () => parsePlaybackRate(word),
    new RegExp(`velocidade recusada: recebido "${word}", esperado 0\\.25\\.\\.4`),
  )
  assert.throws(
    () => parsePlaybackRate('8'),
    /velocidade recusada: recebido "8", esperado 0\.25\.\.4/,
  )
})

test('rateMenuOptions lista 0.25x até 2.0x', () => {
  const labels = rateMenuOptions().map((row) => row.label)
  assert.deepEqual(labels, ['0.25x', '0.5x', '0.75x', '1.0x', '1.25x', '1.5x', '1.75x', '2.0x'])
})
