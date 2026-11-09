import assert from 'node:assert/strict'
import test from 'node:test'

import { waitYoutubeAuth } from '../src/youtubeAuthPoll.mjs'

test('waitYoutubeAuth para no authorized e não espera o resto', async () => {
  const seen = []
  const status = await waitYoutubeAuth({
    check: async () => {
      seen.push('check')
      return seen.length < 2 ? 'pending' : 'authorized'
    },
    sleep: async () => {
      seen.push('sleep')
    },
    maxTries: 8,
  })
  assert.equal(status, 'authorized')
  assert.deepEqual(seen, ['check', 'sleep', 'check'])
})

test('waitYoutubeAuth recusa janela fechada antes do SAPISID', async () => {
  await assert.rejects(
    () =>
      waitYoutubeAuth({
        check: async () => 'no_window',
        sleep: async () => {},
        maxTries: 3,
      }),
    /youtube recusou: recebido janela fechada, esperado login concluído/,
  )
})

test('waitYoutubeAuth recusa se o Google nunca autorizar', async () => {
  let checks = 0
  await assert.rejects(
    () =>
      waitYoutubeAuth({
        check: async () => {
          checks += 1
          return 'pending'
        },
        sleep: async () => {},
        maxTries: 3,
      }),
    /youtube recusou: recebido login pendente, esperado conta Google autorizada/,
  )
  assert.equal(checks, 3)
})
