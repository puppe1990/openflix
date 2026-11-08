import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerPrimeNav } from './factories.mjs'

faker.seed(20261107)

const { parseEnrichNav } = await import('../src/primeNav.mjs')
const { primeLandingForm } = await import('../src/primeLandingForm.mjs')

beforeEach(() => {
  faker.seed(20261107)
})

test('primeLandingForm monta o POST com schemes e o targetId do destino', () => {
  const dest = parseEnrichNav(fakerPrimeNav()).find((item) => item.key === 'merch:mgForYou')
  const form = primeLandingForm(dest)
  assert.equal(form.get('pageType'), 'merch')
  assert.equal(form.get('pageId'), 'mgForYou')
  assert.equal(form.get('targetId'), dest.targetId)
  assert.equal(form.get('pageNumber'), '0')
  assert.equal(form.get('startIndex'), '0')
  assert.equal(form.get('pageSize'), '6')
  assert.equal(form.get('variant'), 'desktopOSX')
  assert.equal(form.get('widgetScheme'), 'web-explore-v48')
  assert.equal(form.get('serviceToken'), null)
})

test('primeLandingForm omite targetId vazio e inclui serviceToken quando vem da paginação', () => {
  const dest = parseEnrichNav(fakerPrimeNav())[0]
  const token = `v0_${faker.string.alphanumeric(24)}`
  const form = primeLandingForm(dest, { pageNumber: 2, startIndex: 6, serviceToken: token })
  assert.equal(form.get('targetId'), null)
  assert.equal(form.get('pageNumber'), '2')
  assert.equal(form.get('startIndex'), '6')
  assert.equal(form.get('serviceToken'), token)
})

test('primeLandingForm recusa destino sem pageType e pageId', () => {
  assert.throws(
    () => primeLandingForm({ key: 'x', pageType: '', pageId: '' }),
    /landing recusado: recebido :, esperado pageType e pageId/,
  )
})
