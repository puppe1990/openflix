import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerYoutubeSearch, fakerYoutubeVideoRenderer } from './factories.mjs'

faker.seed(20261108)

const { parseYoutubeSearch } = await import('../src/youtubeSearch.mjs')

beforeEach(() => {
  faker.seed(20261108)
})

test('parseYoutubeSearch junta videoRenderer numa fileira da query', () => {
  const query = faker.lorem.words({ min: 1, max: 3 })
  const video = fakerYoutubeVideoRenderer({ title: 'Slipknot', videoId: 'Slipknot011' })
  const rows = parseYoutubeSearch(fakerYoutubeSearch({ videos: [video] }), query)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].title, query)
  assert.equal(rows[0].cards[0].videoId, 'Slipknot011')
  assert.equal(rows[0].cards[0].title, 'Slipknot')
})

test('parseYoutubeSearch recusa query vazia', () => {
  assert.throws(
    () => parseYoutubeSearch(fakerYoutubeSearch(), '   '),
    /busca do youtube recusada: recebido vazio, esperado texto/,
  )
})
