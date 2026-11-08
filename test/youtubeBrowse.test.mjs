import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  faker,
  fakerYoutubeBrowse,
  fakerYoutubeLockup,
  fakerYoutubeVideoRenderer,
} from './factories.mjs'

faker.seed(20261108)

const { parseYoutubeBrowse } = await import('../src/youtubeBrowse.mjs')

beforeEach(() => {
  faker.seed(20261108)
})

test('parseYoutubeBrowse vira fileiras com videoRenderer e lockupViewModel', () => {
  const video = fakerYoutubeVideoRenderer({
    title: 'Breakdown',
    videoId: 'abcdefghijk',
    channel: 'Canal Demo',
    coverUrl: 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg',
    length: '8:12',
  })
  const lockup = fakerYoutubeLockup({
    title: 'Ao vivo no estúdio',
    videoId: 'lmnopqrstuv',
    coverUrl: 'https://i.ytimg.com/vi/lmnopqrstuv/hqdefault.jpg',
  })
  const rows = parseYoutubeBrowse(
    fakerYoutubeBrowse({
      grid: [video],
      shelfTitle: 'Continuar assistindo',
      shelf: [lockup],
    }),
  )
  assert.equal(rows.length, 2)
  assert.equal(rows[0].title, 'Início')
  assert.equal(rows[0].cards[0].videoId, 'abcdefghijk')
  assert.equal(rows[0].cards[0].title, 'Breakdown')
  assert.equal(rows[0].cards[0].channel, 'Canal Demo')
  assert.equal(rows[0].cards[0].length, '8:12')
  assert.equal(rows[0].cards[0].coverUrl, 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg')
  assert.equal(rows[1].title, 'Continuar assistindo')
  assert.equal(rows[1].cards[0].videoId, 'lmnopqrstuv')
  assert.equal(rows[1].cards[0].title, 'Ao vivo no estúdio')
})

test('parseYoutubeBrowse ignora lockup que não é vídeo e payload vazio', () => {
  const playlist = fakerYoutubeLockup({ title: 'Mix', videoId: 'playlist011' })
  playlist.contentType = 'LOCKUP_CONTENT_TYPE_PLAYLIST'
  const rows = parseYoutubeBrowse(
    fakerYoutubeBrowse({
      grid: [],
      shelfTitle: 'Playlists',
      shelf: [playlist],
    }),
  )
  assert.deepEqual(rows, [])
  assert.deepEqual(parseYoutubeBrowse({}), [])
})
