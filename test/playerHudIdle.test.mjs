import assert from 'node:assert/strict'
import { test } from 'node:test'
import { PLAYER_HUD_IDLE_MS, playerHudShouldHide } from '../src/playerHudIdle.mjs'

test('HUD some depois do idle só com o vídeo tocando', () => {
  assert.equal(PLAYER_HUD_IDLE_MS, 2800)
  assert.equal(playerHudShouldHide({ paused: false, idleMs: 2799 }), false)
  assert.equal(playerHudShouldHide({ paused: false, idleMs: 2800 }), true)
  assert.equal(playerHudShouldHide({ paused: false, idleMs: 4000 }), true)
})

test('HUD fica visível quando pausa ou o menu Qualidade está aberto', () => {
  assert.equal(playerHudShouldHide({ paused: true, idleMs: 9000 }), false)
  assert.equal(playerHudShouldHide({ paused: false, pinned: true, idleMs: 9000 }), false)
})

test('playerHudShouldHide recusa idle negativo', () => {
  assert.throws(
    () => playerHudShouldHide({ idleMs: -1 }),
    /idle do hud recusado: recebido -1, esperado ms >= 0/,
  )
})
