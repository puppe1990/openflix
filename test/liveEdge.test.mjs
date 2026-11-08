import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import { liveEdgeTime, seekToLiveEdge } from '../src/liveEdge.mjs'

beforeEach(() => {
  faker.seed(91)
})

function videoWithSeekable(end, currentTime = 0) {
  return {
    currentTime,
    seekable: {
      length: 1,
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
