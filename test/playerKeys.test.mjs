import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import { applyPlayerMediaAction, playerMediaAction } from '../src/playerKeys.mjs'

beforeEach(() => {
  faker.seed(88)
})

test('espaço e k pausam ou tocam', () => {
  assert.equal(playerMediaAction(' '), 'toggle-play')
  assert.equal(playerMediaAction('k'), 'toggle-play')
  assert.equal(playerMediaAction('K'), 'toggle-play')
  assert.equal(playerMediaAction('MediaPlayPause'), 'toggle-play')
})

test('m silencia', () => {
  assert.equal(playerMediaAction('m'), 'mute')
  assert.equal(playerMediaAction('M'), 'mute')
  assert.equal(playerMediaAction('AudioVolumeMute'), 'mute')
})

test('outra tecla não mexe no player', () => {
  assert.equal(playerMediaAction('Enter'), null)
  assert.equal(playerMediaAction('f'), null)
  assert.equal(playerMediaAction(faker.string.alpha({ length: 2 })), null)
})

test('no projetor OK pausa e as setas pulam 10s', () => {
  const remote = { leanback: true }
  assert.equal(playerMediaAction('Enter', remote), 'toggle-play')
  assert.equal(playerMediaAction('ArrowLeft', remote), 'seek-back')
  assert.equal(playerMediaAction('ArrowRight', remote), 'seek-forward')
  assert.equal(playerMediaAction('Enter'), null)
  assert.equal(playerMediaAction('ArrowLeft'), null)
})

test('no projetor ao vivo as setas não pulam', () => {
  const remote = { leanback: true, live: true }
  assert.equal(playerMediaAction('Enter', remote), 'toggle-play')
  assert.equal(playerMediaAction('ArrowLeft', remote), null)
  assert.equal(playerMediaAction('ArrowRight', remote), null)
  assert.equal(playerMediaAction('MediaRewind', remote), null)
  assert.equal(playerMediaAction('MediaFastForward', remote), null)
})

test('applyPlayerMediaAction pausa o vídeo que está tocando', () => {
  const video = {
    paused: false,
    muted: false,
    volume: 1,
    play: () => {},
    pause() {
      this.paused = true
    },
  }
  applyPlayerMediaAction(video, 'toggle-play')
  assert.equal(video.paused, true)
})

test('applyPlayerMediaAction silencia e volta o volume', () => {
  const video = { paused: false, muted: false, volume: 0.8 }
  applyPlayerMediaAction(video, 'mute')
  assert.equal(video.muted, true)
  applyPlayerMediaAction(video, 'mute')
  assert.equal(video.muted, false)
  assert.equal(video.volume, 0.8)
})

test('applyPlayerMediaAction recusa ação desconhecida', () => {
  assert.throws(
    () => applyPlayerMediaAction({ paused: true }, 'stop'),
    /ação recusada: recebido "stop", esperado toggle-play, mute, seek-back ou seek-forward/,
  )
})

test('applyPlayerMediaAction no projetor recua e avança 10s', () => {
  const video = { paused: false, currentTime: 40, duration: 90 }
  applyPlayerMediaAction(video, 'seek-back')
  assert.equal(video.currentTime, 30)
  applyPlayerMediaAction(video, 'seek-forward')
  assert.equal(video.currentTime, 40)
})
