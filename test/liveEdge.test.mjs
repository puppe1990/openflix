import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import { liveEdgeTime, seekToLiveEdge } from '../src/liveEdge.mjs'

beforeEach(() => {
  faker.seed(91)
})

function videoWithSeekable(end, currentTime = 0, start = 0) {
  return {
    currentTime,
    seekable: {
      length: 1,
      start: () => start,
      end: () => end,
    },
  }
}

test('liveEdgeTime prefere liveSyncPosition do hls', () => {
  const edge = faker.number.float({ min: 80, max: 140, fractionDigits: 1 })
  const video = videoWithSeekable(edge + 12, edge - 40)
  assert.equal(liveEdgeTime(video, { liveSyncPosition: edge }), edge)
})

test('liveEdgeTime cai no fim do seekable quando o hls não tem borda', () => {
  const end = faker.number.float({ min: 30, max: 90, fractionDigits: 1 })
  const video = videoWithSeekable(end, 4)
  assert.equal(liveEdgeTime(video, { liveSyncPosition: null }), end)
})

test('seekToLiveEdge grava currentTime na borda ao vivo', () => {
  const edge = faker.number.float({ min: 60, max: 120, fractionDigits: 1 })
  const video = videoWithSeekable(edge + 8, 3)
  assert.equal(seekToLiveEdge(video, { liveSyncPosition: edge }), true)
  assert.equal(video.currentTime, edge)
})

test('seekToLiveEdge recusa video ausente', () => {
  assert.throws(
    () => seekToLiveEdge(null, { liveSyncPosition: 12 }),
    /video recusado: recebido null, esperado elemento/,
  )
})

test('liveEdgeTime nativo fica 8s atrás do seekable', () => {
  const end = faker.number.float({ min: 80, max: 140, fractionDigits: 1 })
  const video = videoWithSeekable(end, 4)
  assert.equal(liveEdgeTime(video, null), end - 8)
})

test('seekToLiveEdge nativo não cola na borda', () => {
  const end = faker.number.float({ min: 60, max: 120, fractionDigits: 1 })
  const video = videoWithSeekable(end, 3)
  assert.equal(seekToLiveEdge(video, null), true)
  assert.equal(video.currentTime, end - 8)
})

test('liveEdgeTime nativo não passa do início do seekable', () => {
  const start = faker.number.float({ min: 40, max: 80, fractionDigits: 1 })
  const end = start + 4
  const video = videoWithSeekable(end, start, start)
  assert.equal(liveEdgeTime(video, null), start)
})

test('liveEdgeTime nativo ignora janela EVENT enorme', () => {
  const currentTime = faker.number.float({ min: 20, max: 90, fractionDigits: 1 })
  const video = videoWithSeekable(1_511_828.5, currentTime)
  assert.equal(liveEdgeTime(video, null), null)
})

test('seekToLiveEdge nativo não pula para o EVENT fantasma', () => {
  const currentTime = faker.number.float({ min: 20, max: 90, fractionDigits: 1 })
  const video = videoWithSeekable(1_511_828.5, currentTime)
  assert.equal(seekToLiveEdge(video, null), false)
  assert.equal(video.currentTime, currentTime)
})
