import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { faker } from './factories.mjs'
import { isLeanbackApp, shouldEnterPlayerFullscreen } from '../src/tvRemote.mjs'

afterEach(() => {
  delete globalThis.OpenFlixHouse
})

test('OpenFlixHouse marca o app do projetor', () => {
  assert.equal(isLeanbackApp(undefined), false)
  assert.equal(isLeanbackApp(null), false)
  assert.equal(isLeanbackApp({ leave() {} }), true)
  globalThis.OpenFlixHouse = { leave() {} }
  assert.equal(isLeanbackApp(), true)
})

test('desktop não entra em tela cheia sozinho', () => {
  assert.equal(shouldEnterPlayerFullscreen({ leanback: false, screen: 'player' }), false)
  assert.equal(shouldEnterPlayerFullscreen({ screen: 'player' }), false)
})

test('projetor abre o player já em tela cheia', () => {
  assert.equal(shouldEnterPlayerFullscreen({ leanback: true, screen: 'player' }), true)
  assert.equal(shouldEnterPlayerFullscreen({ leanback: true, screen: 'catalog' }), false)
  assert.equal(
    shouldEnterPlayerFullscreen({
      leanback: true,
      screen: faker.helpers.arrayElement(['home', 'settings']),
    }),
    false,
  )
})
