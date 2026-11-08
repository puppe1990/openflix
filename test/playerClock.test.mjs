import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import { formatPlayerClock } from '../src/playerClock.mjs'

beforeEach(() => {
  faker.seed(73)
})

test('formatPlayerClock pinta MM:SS com minutos zerados', () => {
  assert.equal(formatPlayerClock(0), '00:00')
  assert.equal(formatPlayerClock(1725), '28:45')
  assert.equal(formatPlayerClock(3260), '54:20')
  assert.equal(formatPlayerClock(102), '01:42')
})

test('formatPlayerClock pinta H:MM:SS depois de uma hora', () => {
  assert.equal(formatPlayerClock(3723), '1:02:03')
})

test('formatPlayerClock recusa valor que não é segundo >= 0', () => {
  const bad = faker.lorem.word()
  assert.throws(
    () => formatPlayerClock(bad),
    new RegExp(`relógio recusado: recebido "${bad}", esperado segundos >= 0`),
  )
  assert.throws(() => formatPlayerClock(-1), /relógio recusado/)
})
