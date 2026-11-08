import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { CATALOG_TTL_MS, readFreshCatalog, writeCatalogCache } from '../src/catalogCache.mjs'
import { faker, fakerCategory, fakerLiveStream } from './factories.mjs'
import { mapCatalog } from '../src/mapCatalog.mjs'
import { createJsonBucket } from '../src/jsonBucket.mjs'

beforeEach(() => {
  faker.seed(81)
})

function liveCatalog() {
  const category = fakerCategory({ id: 4, name: faker.commerce.department() })
  const stream = fakerLiveStream({ categoryId: 4 })
  return mapCatalog({ kind: 'live', categories: [category], streams: [stream] })
}

function memoryBucket() {
  return createJsonBucket({ key: 'life-tv:catalogs' })
}

test('grava e lê o catálogo live fresco do faker', () => {
  const bucket = memoryBucket()
  const catalog = liveCatalog()
  const playlistId = faker.string.alphanumeric(8)
  const now = faker.date.recent().getTime()
  writeCatalogCache(bucket, { playlistId, kind: 'live', catalog, now })
  assert.deepEqual(readFreshCatalog(bucket, { playlistId, kind: 'live', now }), catalog)
})

test('catálogo vencido não é reusado', () => {
  const bucket = memoryBucket()
  const catalog = liveCatalog()
  const playlistId = faker.string.alphanumeric(8)
  const savedAt = faker.date.recent().getTime()
  writeCatalogCache(bucket, { playlistId, kind: 'live', catalog, now: savedAt })
  const staleAt = savedAt + CATALOG_TTL_MS + 1
  assert.equal(readFreshCatalog(bucket, { playlistId, kind: 'live', now: staleAt }), null)
})

test('playlist diferente não lê o catálogo da outra', () => {
  const bucket = memoryBucket()
  const catalog = liveCatalog()
  writeCatalogCache(bucket, {
    playlistId: faker.string.alphanumeric(8),
    kind: 'live',
    catalog,
    now: Date.now(),
  })
  assert.equal(
    readFreshCatalog(bucket, {
      playlistId: faker.string.alphanumeric(8),
      kind: 'live',
      now: Date.now(),
    }),
    null,
  )
})

test('fonte xc não lê o cache m3u da mesma playlist', () => {
  const bucket = memoryBucket()
  const catalog = liveCatalog()
  const playlistId = faker.string.alphanumeric(8)
  const now = Date.now()
  writeCatalogCache(bucket, { playlistId, kind: 'live', source: 'm3u', catalog, now })
  assert.equal(readFreshCatalog(bucket, { playlistId, kind: 'live', source: 'xc', now }), null)
  assert.deepEqual(
    readFreshCatalog(bucket, { playlistId, kind: 'live', source: 'm3u', now }),
    catalog,
  )
})
