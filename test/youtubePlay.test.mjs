import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerYoutubeVideoId } from './factories.mjs'

faker.seed(20261108)

const { playableYoutubeItem, youtubeProxyUrl } = await import('../src/youtubePlay.mjs')

beforeEach(() => {
  faker.seed(20261108)
})

test('youtubeProxyUrl monta /video/{id}.mp4 no loopback', () => {
  const videoId = fakerYoutubeVideoId()
  const port = faker.number.int({ min: 40000, max: 50000 })
  const base = `http://127.0.0.1:${port}`
  assert.equal(youtubeProxyUrl(base, videoId), `${base}/video/${videoId}.mp4`)
})

test('youtubeProxyUrl recusa id curto e host que não é loopback', () => {
  const videoId = fakerYoutubeVideoId()
  assert.throws(
    () => youtubeProxyUrl('http://127.0.0.1:9', 'abc'),
    /url do youtube recusada: recebido abc, esperado videoId de 11 caracteres/,
  )
  assert.throws(
    () => youtubeProxyUrl('https://googlevideo.com', videoId),
    /url do youtube recusada: recebido https:\/\/googlevideo.com, esperado http:\/\/127.0.0.1/,
  )
})

test('playableYoutubeItem injeta a url do proxy no item do player', () => {
  const videoId = fakerYoutubeVideoId()
  const title = faker.music.songName()
  const coverUrl = faker.image.url()
  const item = playableYoutubeItem(
    { videoId, title, coverUrl, channel: faker.person.fullName() },
    'http://127.0.0.1:43111',
  )
  assert.equal(item.id, videoId)
  assert.equal(item.name, title)
  assert.equal(item.icon, coverUrl)
  assert.equal(item.url, `http://127.0.0.1:43111/video/${videoId}.mp4`)
})

test('playableYoutubeItem de live aponta o proxy para .m3u8', () => {
  const videoId = fakerYoutubeVideoId()
  const title = faker.music.songName()
  const item = playableYoutubeItem(
    { videoId, title, coverUrl: faker.image.url() },
    'http://127.0.0.1:43111',
    {
      kind: 'hls',
      url: `https://manifest.googlevideo.com/api/manifest/hls_variant/${videoId}/file/index.m3u8`,
    },
  )
  assert.equal(item.url, `http://127.0.0.1:43111/video/${videoId}.m3u8`)
  assert.equal(youtubeProxyUrl('http://127.0.0.1:43111', videoId, 'hls'), item.url)
})
