import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import {
  applyVolumeEvent,
  shouldConsumeVolumeKey,
  shouldForceMaxVolume,
} from '../src/volumePolicy.mjs'

beforeEach(() => {
  faker.seed(112)
})

test('Vol- deixa o volume onde o sistema colocou', () => {
  const max = 15
  const lowered = faker.number.int({ min: 0, max: max - 1 })
  const next = applyVolumeEvent({ streamVolume: lowered, max, reason: 'volume_changed' })
  assert.equal(next.streamVolume, lowered)
})

test('tecla de volume não é engolida nem recoloca o teto', () => {
  assert.equal(shouldConsumeVolumeKey('volume_down'), false)
  assert.equal(shouldForceMaxVolume('volume_key'), false)
})

test('abrir o app põe no teto; resume e Vol- não', () => {
  const max = 15
  const lowered = faker.number.int({ min: 0, max: max - 1 })
  assert.equal(shouldForceMaxVolume('start'), true)
  assert.equal(applyVolumeEvent({ streamVolume: lowered, max, reason: 'start' }).streamVolume, max)
  assert.equal(shouldForceMaxVolume('resume'), false)
})
