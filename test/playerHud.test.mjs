import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import {
  cinemaBrandLabel,
  playbackRateLabel,
  playerClockRange,
  playerHudChrome,
  playerHudProgress,
  playerSeekTarget,
  playerVolumeLabel,
  playerVolumePercent,
} from '../src/playerHud.mjs'

beforeEach(() => {
  faker.seed(74)
})

test('cinemaBrandLabel usa a marca OpenFlix em caixa alta', () => {
  assert.equal(cinemaBrandLabel('OpenFlix'), 'OPENFLIX CINEMA')
  assert.equal(cinemaBrandLabel('OpenFlix').includes('STREAMFLIX'), false)
})

test('cinemaBrandLabel recusa marca vazia', () => {
  assert.throws(() => cinemaBrandLabel(''), /marca recusada: recebido "", esperado nome/)
})

test('playerHudProgress monta a barra 28:45 / 54:20', () => {
  const progress = playerHudProgress({ current: 1725, duration: 3260 })
  assert.equal(progress.currentLabel, '28:45')
  assert.equal(progress.durationLabel, '54:20')
  assert.equal(progress.ratio, 1725 / 3260)
  assert.equal(progress.seekable, true)
  assert.equal(playerClockRange(1725, 3260), '28:45 / 54:20')
})

test('playerHudProgress sem duração não busca', () => {
  const progress = playerHudProgress({ current: 12, duration: Number.POSITIVE_INFINITY })
  assert.equal(progress.seekable, false)
  assert.equal(progress.ratio, 0)
  assert.equal(progress.durationLabel, '--:--')
})

test('playerSeekTarget pula 10s e prende nos extremos', () => {
  assert.equal(playerSeekTarget({ current: 1725, duration: 3260, delta: 10 }), 1735)
  assert.equal(playerSeekTarget({ current: 1725, duration: 3260, delta: -10 }), 1715)
  assert.equal(playerSeekTarget({ current: 4, duration: 3260, delta: -10 }), 0)
  assert.equal(playerSeekTarget({ current: 3255, duration: 3260, delta: 10 }), 3260)
})

test('playerHudChrome de filme VOD libera seek, pulo e velocidade', () => {
  const chrome = playerHudChrome({ catalogKind: 'movies', duration: 3260 })
  assert.equal(chrome.isLive, false)
  assert.equal(chrome.seekable, true)
  assert.equal(chrome.canSkip, true)
  assert.equal(chrome.canRate, true)
  assert.equal(chrome.skipIntro, false)
  assert.equal(chrome.nextEpisode, false)
  assert.equal(chrome.badge, '')
})

test('playerHudChrome de ao vivo esconde pulo e abertura', () => {
  const chrome = playerHudChrome({ catalogKind: 'live', duration: 90 })
  assert.equal(chrome.isLive, true)
  assert.equal(chrome.seekable, false)
  assert.equal(chrome.canSkip, false)
  assert.equal(chrome.canRate, false)
  assert.equal(chrome.badge, 'Ao vivo')
})

test('playerHudChrome de série só mostra próximo e abertura com dado real', () => {
  const empty = playerHudChrome({
    catalogKind: 'series',
    duration: 2400,
    item: { name: faker.lorem.words(2) },
  })
  assert.equal(empty.isSeries, true)
  assert.equal(empty.badge, 'Série')
  assert.equal(empty.skipIntro, false)
  assert.equal(empty.nextEpisode, false)
  const filled = playerHudChrome({
    catalogKind: 'series',
    duration: 2400,
    item: { introEnd: 102, nextEpisode: { id: 2, name: faker.lorem.words(2) } },
  })
  assert.equal(filled.skipIntro, true)
  assert.equal(filled.nextEpisode, true)
})

test('playbackRateLabel pinta 1.0x', () => {
  assert.equal(playbackRateLabel(1), '1.0x')
  assert.equal(playbackRateLabel(1.5), '1.5x')
})

test('playerVolumePercent converte 0..1 em 0..100', () => {
  assert.equal(playerVolumePercent({ volume: 1 }), 100)
  assert.equal(playerVolumePercent({ volume: 0.4 }), 40)
  assert.equal(playerVolumePercent({ volume: 0 }), 0)
})

test('playerVolumePercent no mudo devolve 0', () => {
  assert.equal(playerVolumePercent({ volume: 0.8, muted: true }), 0)
})

test('playerVolumePercent recusa volume que não é número', () => {
  assert.throws(
    () => playerVolumePercent({ volume: faker.lorem.word() }),
    /volume recusado: recebido ".*", esperado 0\.\.1/,
  )
})

test('playerVolumeLabel pinta o percentual', () => {
  assert.equal(playerVolumeLabel({ volume: 0.4 }), '40%')
  assert.equal(playerVolumeLabel({ volume: 1, muted: true }), '0%')
})
