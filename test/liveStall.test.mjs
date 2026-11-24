import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerPortal } from './factories.mjs'
import {
  LIVE_RELOAD_COOLDOWN_MS,
  applyLiveStallAction,
  createLiveStallWatch,
  tickLiveStall,
} from '../src/liveStall.mjs'

beforeEach(() => {
  faker.seed(18)
})

function snap(overrides = {}) {
  const end = overrides.seekableEnd ?? faker.number.float({ min: 80, max: 140, fractionDigits: 1 })
  return {
    live: true,
    paused: false,
    currentTime: end - 8,
    seekableEnd: end,
    now: 1_000,
    ...overrides,
  }
}

test('pausa na borda do HLS nativo pede reload da playlist', () => {
  const end = faker.number.float({ min: 200, max: 400, fractionDigits: 1 })
  const next = tickLiveStall(
    { lastTime: end, consecutive: 0 },
    snap({ paused: true, currentTime: end, seekableEnd: end }),
  )
  assert.equal(next.action, 'reload')
})

test('pausa 8s atrás da borda não é stall', () => {
  const end = faker.number.float({ min: 80, max: 140, fractionDigits: 1 })
  const next = tickLiveStall(
    { lastTime: end - 8, consecutive: 0 },
    snap({ paused: true, currentTime: end - 8, seekableEnd: end }),
  )
  assert.equal(next.action, null)
  assert.equal(next.consecutive, 0)
})

test('play congelado pede nudge no segundo tick e reload no terceiro', () => {
  const t = faker.number.float({ min: 40, max: 90, fractionDigits: 1 })
  const first = tickLiveStall(
    { lastTime: t, consecutive: 0 },
    snap({ currentTime: t, seekableEnd: t + 20 }),
  )
  assert.equal(first.action, null)
  const second = tickLiveStall(first, snap({ currentTime: t, seekableEnd: t + 20 }))
  assert.equal(second.action, 'nudge')
  const third = tickLiveStall(second, snap({ currentTime: t, seekableEnd: t + 20 }))
  assert.equal(third.action, 'reload')
})

test('play avançando zera o contador', () => {
  const t = faker.number.float({ min: 40, max: 90, fractionDigits: 1 })
  const stalled = tickLiveStall(
    { lastTime: t, consecutive: 0 },
    snap({ currentTime: t, seekableEnd: t + 20 }),
  )
  const next = tickLiveStall(stalled, snap({ currentTime: t + 2, seekableEnd: t + 22 }))
  assert.equal(next.action, null)
  assert.equal(next.consecutive, 0)
})

test('reload respeita o cooldown para não martelar o portal', () => {
  const end = faker.number.float({ min: 200, max: 400, fractionDigits: 1 })
  const death = { paused: true, currentTime: end, seekableEnd: end, now: 20_000 }
  const first = tickLiveStall(
    { lastTime: end, consecutive: 0, reloadedAt: 20_000 - 1_000 },
    snap(death),
  )
  assert.equal(first.action, null)
  const later = tickLiveStall(
    { lastTime: end, consecutive: 1, reloadedAt: 20_000 - LIVE_RELOAD_COOLDOWN_MS },
    snap({ ...death, now: 20_000 }),
  )
  assert.equal(later.action, 'reload')
})

test('applyLiveStallAction nudge busca a borda e dá play', () => {
  const calls = []
  applyLiveStallAction('nudge', {
    seekToLive: () => calls.push('seek'),
    play: () => calls.push('play'),
    rebind: () => calls.push('rebind'),
    url: `${fakerPortal()}/live/user/pass/62.m3u8`,
  })
  assert.deepEqual(calls, ['seek', 'play'])
})

test('applyLiveStallAction reload rebinda o mesmo link sem query', () => {
  const calls = []
  const url = `${fakerPortal()}/live/user/pass/62.m3u8`
  applyLiveStallAction('reload', {
    seekToLive: () => calls.push('seek'),
    play: () => calls.push('play'),
    rebind: (next) => calls.push(next),
    url,
  })
  assert.deepEqual(calls, [url])
})

test('createLiveStallWatch dispara reload na borda e para no stop', () => {
  const ticks = []
  const actions = []
  const watch = createLiveStallWatch({
    intervalMs: 2_000,
    setIntervalFn: (fn) => {
      ticks.push(fn)
      return 7
    },
    clearIntervalFn: (id) => {
      ticks.push(['clear', id])
    },
  })
  const end = faker.number.float({ min: 80, max: 120, fractionDigits: 1 })
  watch.start(
    () => snap({ paused: true, currentTime: end, seekableEnd: end, now: 30_000 }),
    (action) => actions.push(action),
  )
  ticks[0]()
  assert.deepEqual(actions, ['reload'])
  watch.stop()
  assert.deepEqual(ticks.at(-1), ['clear', 7])
})
