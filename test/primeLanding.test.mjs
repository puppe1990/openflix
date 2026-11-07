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

test('parseLanding usa o horário ao vivo do evento como selo', () => {
  const entity = fakerPrimeEntity({
    title: 'Atlético MG x Grêmio',
    titleID: 'amzn1.dv.gti.sport',
    entitlement: 'Incluído no Prime',
  })
  entity.entityType = 'EVENT'
  entity.liveInfo = { status: 'UPCOMING', timeBadge: 'Ao vivo às 17:00 BRT' }
  const page = parseLanding(
    fakerPrimeLanding({
      containers: [
        { containerType: 'BeardSupportedCarousel', title: 'Ao vivo', entities: [entity] },
      ],
    }),
  )
  assert.equal(page.rows[0].cards[0].entitlement, 'Ao vivo às 17:00 BRT')
})

test('parseLanding guarda liga sem titleID pelo impressionId', () => {
  const page = parseLanding(
    fakerPrimeLanding({
      containers: [
        {
          containerType: 'Nodes',
          title: 'Explorar mais ligas',
          entities: [
            {
              displayTitle: 'Série A',
              impressionId: 'amzn1.dv.icid.serie-a',
              images: { cover: { url: 'https://m.media-amazon.com/images/S/league.png' } },
              link: { url: '/-/pt/tournament/amzn1.dv.icid.serie-a' },
            },
          ],
        },
      ],
    }),
  )
  assert.equal(page.rows.length, 1)
  assert.equal(page.rows[0].title, 'Explorar mais ligas')
  assert.equal(page.rows[0].cards[0].title, 'Série A')
  assert.equal(page.rows[0].cards[0].titleId, 'amzn1.dv.icid.serie-a')
  assert.equal(
    page.rows[0].cards[0].href,
    'https://www.primevideo.com/-/pt/tournament/amzn1.dv.icid.serie-a',
  )
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
