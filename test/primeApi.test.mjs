import assert from 'node:assert/strict'
import { test } from 'node:test'
import { assertPrimeRequest, PRIME_ENRICH_NAV, PRIME_LANDING } from '../src/primeApi.mjs'

test('assertPrimeRequest aceita só enrichNav GET e getLandingPage POST', () => {
  assert.doesNotThrow(() => assertPrimeRequest('GET', PRIME_ENRICH_NAV))
  assert.doesNotThrow(() => assertPrimeRequest('POST', PRIME_LANDING))
  assert.throws(
    () => assertPrimeRequest('POST', PRIME_ENRICH_NAV),
    /endpoint do prime recusado: recebido POST \/api\/enrichNav, esperado GET \/api\/enrichNav ou POST \/api\/getLandingPage/,
  )
  assert.throws(
    () => assertPrimeRequest('GET', '/playback/prs/GetVodPlaybackResources'),
    /endpoint do prime recusado: recebido GET \/playback\/prs\/GetVodPlaybackResources/,
  )
})
