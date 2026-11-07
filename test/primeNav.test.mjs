import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerPrimeNav, fakerPrimeNavNode } from './factories.mjs'

faker.seed(20261107)

const { PRIME_HOME_DEST, parseEnrichNav, primeDest } = await import('../src/primeNav.mjs')

beforeEach(() => {
  faker.seed(20261107)
})

test('parseEnrichNav coloca Início na frente e destinos do enrichNav em seguida', () => {
  const dests = parseEnrichNav(fakerPrimeNav())
  assert.equal(dests[0].key, 'home:home')
  assert.equal(dests[0].label, PRIME_HOME_DEST.label)
  assert.deepEqual(
    dests.slice(1).map((dest) => dest.key),
    ['genre:av_genre_action', 'merch:mgForYou', 'home:store'],
  )
  assert.equal(dests[1].group, 'Gêneros')
  assert.equal(dests[2].label, 'Feito para você')
  assert.match(dests[2].url, /^https:\/\/www\.primevideo\.com\/collection\/mgForYou/)
  assert.ok(dests[2].targetId.startsWith('V2='))
})

test('primeDest acha pela chave e recusa chave desconhecida', () => {
  const dests = parseEnrichNav(fakerPrimeNav())
  assert.equal(primeDest(dests, 'merch:mgForYou').pageId, 'mgForYou')
  assert.throws(
    () => primeDest(dests, 'porn'),
    /destino recusado: recebido porn, esperado home:home, genre:av_genre_action/,
  )
})

test('parseEnrichNav recusa payload sem o tipo EnrichNavOutput', () => {
  assert.throws(
    () => parseEnrichNav({ __type: 'nope' }),
    /enrichNav recusado: recebido nope, esperado atv.wps#EnrichNavOutput/,
  )
  assert.throws(
    () => parseEnrichNav(null),
    /enrichNav recusado: recebido null, esperado atv.wps#EnrichNavOutput/,
  )
})

test('parseEnrichNav recusa nó sem pageType e pageId', () => {
  const payload = fakerPrimeNav({
    categoryGroups: [
      {
        id: 'V2=x',
        label: 'Gêneros',
        subNodes: [fakerPrimeNavNode({ swiftPageType: '', swiftPageId: '' })],
      },
    ],
  })
  assert.throws(
    () => parseEnrichNav(payload),
    /destino recusado: recebido :, esperado swiftPageType e swiftPageId/,
  )
})
