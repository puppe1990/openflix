import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'

faker.seed(20261107)

const { isPrimeVideoUrl, primePlayUrl } = await import('../src/primePlay.mjs')

beforeEach(() => {
  faker.seed(20261107)
})

test('primePlayUrl usa o href oficial do card', () => {
  const titleId = `amzn1.dv.gti.${faker.string.uuid()}`
  const href = `https://www.primevideo.com/detail/${titleId}`
  assert.equal(isPrimeVideoUrl(href), true)
  assert.equal(primePlayUrl({ titleId, href }), href)
})

test('primePlayUrl recusa host parecido e monta o detalhe pelo titleId', () => {
  const titleId = `amzn1.dv.gti.${faker.string.uuid()}`
  const lookalike = `https://www.primevideo.com.${faker.internet.domainName()}/detail/${titleId}`
  assert.equal(isPrimeVideoUrl(lookalike), false)
  assert.equal(
    primePlayUrl({ titleId, href: lookalike }),
    `https://www.primevideo.com/detail/${titleId}`,
  )
})

test('primePlayUrl recusa card sem href oficial nem titleId gti', () => {
  assert.throws(
    () => primePlayUrl({ titleId: 'amzn1.p11cat.linear::1790000000000::pb-x' }),
    /card sem player: recebido amzn1\.p11cat\.linear::1790000000000::pb-x, esperado href https:\/\/www\.primevideo\.com/,
  )
  assert.equal(
    primePlayUrl({ titleId: 'amzn1.dv.gti.x', href: 'http://www.primevideo.com/detail/x' }),
    'https://www.primevideo.com/detail/amzn1.dv.gti.x',
  )
  assert.throws(
    () => primePlayUrl({ titleId: 'amzn1.p11cat.linear::1::pb-x', href: 'http://insecure.test/x' }),
    /card sem player: recebido http:\/\/insecure\.test\/x, esperado href/,
  )
})

test('isPrimeVideoUrl recusa javascript e caminho relativo', () => {
  assert.equal(isPrimeVideoUrl('javascript:alert(1)'), false)
  assert.equal(isPrimeVideoUrl('/detail/amzn1.dv.gti.x'), false)
  assert.equal(isPrimeVideoUrl(''), false)
})
