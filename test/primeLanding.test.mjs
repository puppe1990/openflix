import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerPrimeEntity, fakerPrimeLanding } from './factories.mjs'

faker.seed(20261107)

const { parseLanding } = await import('../src/primeLanding.mjs')

beforeEach(() => {
  faker.seed(20261107)
})

test('parseLanding vira fileiras com capa, ficha e URL absoluta', () => {
  const entity = fakerPrimeEntity({
    title: 'Breakdown',
    titleID: 'amzn1.dv.gti.demo',
    coverUrl: 'https://m.media-amazon.com/images/S/cover.jpg',
    href: '/-/pt/detail/0R6EZ1YUM2278FTY42NGHM7KJO',
    entitlement: 'Comprar ou alugar',
    badge: '14',
  })
  const page = parseLanding(
    fakerPrimeLanding({
      pageTitle: 'Feito para você✨',
      containers: [
        { containerType: 'StandardCarousel', title: 'Suspense psicológico', entities: [entity] },
        { containerType: 'StandardHero', title: '', entities: [] },
      ],
    }),
  )
  assert.equal(page.pageTitle, 'Feito para você✨')
  assert.equal(page.rows.length, 1)
  assert.equal(page.rows[0].title, 'Suspense psicológico')
  const card = page.rows[0].cards[0]
  assert.equal(card.titleId, 'amzn1.dv.gti.demo')
  assert.equal(card.title, 'Breakdown')
  assert.equal(card.coverUrl, 'https://m.media-amazon.com/images/S/cover.jpg')
  assert.equal(card.badge, '14')
  assert.equal(card.entitlement, 'Comprar ou alugar')
  assert.equal(card.href, 'https://www.primevideo.com/-/pt/detail/0R6EZ1YUM2278FTY42NGHM7KJO')
})

test('parseLanding recusa tipo errado e marca hasFailed', () => {
  assert.throws(
    () => parseLanding({ __type: 'nope' }),
    /landing recusado: recebido nope, esperado atv.wps#GetLandingPageOutput/,
  )
  const page = parseLanding(fakerPrimeLanding({ hasFailed: true, containers: [] }))
  assert.equal(page.hasFailed, true)
  assert.equal(page.rows.length, 0)
})
