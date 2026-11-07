import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerPrimeLanding, fakerPrimeNav } from './factories.mjs'

faker.seed(20261107)

const { loadPrimeLanding, loadPrimeNav } = await import('../web/primeClient.mjs')
const { PRIME_HOME_DEST } = await import('../src/primeNav.mjs')

const calls = []

beforeEach(() => {
  faker.seed(20261107)
  calls.length = 0
  globalThis.__TAURI__ = undefined
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method ?? 'GET', body: init?.body ?? '' })
    if (String(url).includes('/api/enrichNav')) {
      return { ok: true, json: async () => fakerPrimeNav() }
    }
    if (String(url).includes('/api/getLandingPage')) {
      return { ok: true, json: async () => fakerPrimeLanding({ pageTitle: 'Feito para você✨' }) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  }
})

test('loadPrimeNav chama enrichNav e devolve Início + destinos', async () => {
  const dests = await loadPrimeNav()
  assert.equal(dests[0].key, PRIME_HOME_DEST.key)
  assert.ok(dests.some((dest) => dest.key === 'merch:mgForYou'))
  assert.match(calls[0].url, /\/api\/enrichNav\?enrichmentType=GET_CATEGORIES/)
  assert.equal(calls[0].method, 'GET')
})

test('loadPrimeLanding posta o form e devolve fileiras', async () => {
  const dests = await loadPrimeNav()
  const dest = dests.find((item) => item.key === 'merch:mgForYou')
  const page = await loadPrimeLanding(dest)
  assert.equal(page.pageTitle, 'Feito para você✨')
  assert.ok(page.rows.length >= 1)
  const landing = calls.find((call) => String(call.url).includes('/api/getLandingPage'))
  assert.equal(landing.method, 'POST')
  assert.match(String(landing.body), /pageType=merch/)
  assert.match(String(landing.body), /pageId=mgForYou/)
})
