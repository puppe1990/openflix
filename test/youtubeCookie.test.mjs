import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'

faker.seed(20261108)

const { filterYoutubeCookie, normalizeYoutubeCookie, youtubeSessionReady } =
  await import('../src/youtubeCookie.mjs')

beforeEach(() => {
  faker.seed(20261108)
})

test('normalizeYoutubeCookie tira o prefixo Cookie: e recusa vazio', () => {
  const sapisid = faker.string.alphanumeric(24)
  const raw = `Cookie: SAPISID=${sapisid}; SID=${faker.string.alphanumeric(12)}`
  const value = normalizeYoutubeCookie(`  ${raw}  `)
  assert.match(value, new RegExp(`^SAPISID=${sapisid};`))
  assert.equal(value.startsWith('Cookie:'), false)
  assert.throws(
    () => normalizeYoutubeCookie('   '),
    /cookie recusado: recebido vazio, esperado pares name=value/,
  )
  assert.throws(
    () => normalizeYoutubeCookie('semigual'),
    /cookie recusado: recebido semigual, esperado pares name=value/,
  )
})

test('filterYoutubeCookie fica só com cookies de sessão YouTube e descarta __Host', () => {
  const sapisid = faker.string.alphanumeric(16)
  const host = faker.string.alphanumeric(8)
  const header = filterYoutubeCookie(
    `SAPISID=${sapisid}; __Host-GAPS=${host}; SID=abc; VISITOR_INFO1_LIVE=v1; LOGIN_INFO=login; PREF=f1`,
  )
  assert.match(header, new RegExp(`SAPISID=${sapisid}`))
  assert.match(header, /SID=abc/)
  assert.match(header, /VISITOR_INFO1_LIVE=v1/)
  assert.match(header, /LOGIN_INFO=login/)
  assert.equal(header.includes('__Host-GAPS'), false)
})

test('youtubeSessionReady exige LOGIN_INFO ou SAPISID; SID sozinho não conta', () => {
  const sapisid = faker.string.alphanumeric(16)
  const login = faker.string.alphanumeric(12)
  assert.equal(
    youtubeSessionReady(`SID=${faker.string.alphanumeric(8)}; VISITOR_INFO1_LIVE=v1`),
    false,
  )
  assert.equal(youtubeSessionReady(`SAPISID=${sapisid}; SID=abc`), true)
  assert.equal(youtubeSessionReady(`LOGIN_INFO=${login}; VISITOR_INFO1_LIVE=v1`), true)
  assert.equal(youtubeSessionReady(''), false)
})
