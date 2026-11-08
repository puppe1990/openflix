import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'

faker.seed(20261107)

const { normalizePrimeCookie } = await import('../src/primeCookie.mjs')

beforeEach(() => {
  faker.seed(20261107)
})

test('normalizePrimeCookie tira o prefixo Cookie: e recusa vazio', () => {
  const session = faker.string.alphanumeric(24)
  const raw = `Cookie: session-id=${session}; ubid-main=${faker.string.alphanumeric(12)}`
  const value = normalizePrimeCookie(`  ${raw}  `)
  assert.match(value, new RegExp(`^session-id=${session};`))
  assert.equal(value.startsWith('Cookie:'), false)
  assert.throws(
    () => normalizePrimeCookie('   '),
    /cookie recusado: recebido vazio, esperado pares name=value/,
  )
  assert.throws(
    () => normalizePrimeCookie('semigual'),
    /cookie recusado: recebido semigual, esperado pares name=value/,
  )
})
