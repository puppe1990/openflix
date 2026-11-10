import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerYoutubePlayer, fakerYoutubeVideoId } from './factories.mjs'

faker.seed(20261108)

const { pickMuxedProgressive, pickYoutubePlayback } = await import('../src/youtubePlayer.mjs')

beforeEach(() => {
  faker.seed(20261108)
})

test('pickMuxedProgressive escolhe itag 18 com url direta e ignora cipher', () => {
  const videoId = fakerYoutubeVideoId()
  const googlevideo = `https://rr1---sn-host.googlevideo.com/videoplayback?id=${videoId}&itag=18`
  const picked = pickMuxedProgressive(
    fakerYoutubePlayer({ videoId, title: 'Before I Forget', googlevideo }),
  )
  assert.equal(picked.videoId, videoId)
  assert.equal(picked.title, 'Before I Forget')
  assert.equal(picked.itag, 18)
  assert.equal(picked.url, googlevideo)
  assert.match(picked.mimeType, /^video\/mp4/)
})

test('pickMuxedProgressive recusa LOGIN_REQUIRED e formato sem url', () => {
  const videoId = fakerYoutubeVideoId()
  assert.throws(
    () =>
      pickMuxedProgressive(
        fakerYoutubePlayer({ videoId, status: 'LOGIN_REQUIRED', reason: 'Sign in' }),
      ),
    new RegExp(
      `player do youtube recusado: recebido LOGIN_REQUIRED Sign in, esperado OK para ${videoId}`,
    ),
  )
  assert.throws(
    () => pickMuxedProgressive(fakerYoutubePlayer({ videoId, url: '' })),
    new RegExp(
      `player do youtube recusado: recebido nenhum mp4 com url, esperado itag 18 para ${videoId}`,
    ),
  )
})

test('pickYoutubePlayback usa HLS quando a live não tem itag 18', () => {
  const videoId = fakerYoutubeVideoId()
  const hlsManifestUrl = `https://manifest.googlevideo.com/api/manifest/hls_variant/${videoId}/file/index.m3u8`
  const picked = pickYoutubePlayback(
    fakerYoutubePlayer({
      videoId,
      title: 'AO VIVO: NFL MADRID GAME 2026',
      url: '',
      hlsManifestUrl,
    }),
  )
  assert.equal(picked.kind, 'hls')
  assert.equal(picked.videoId, videoId)
  assert.equal(picked.url, hlsManifestUrl)
})

test('pickYoutubePlayback prefere HLS quando o payload tem os dois', () => {
  const videoId = fakerYoutubeVideoId()
  const googlevideo = `https://rr1---sn-host.googlevideo.com/videoplayback?id=${videoId}&itag=18`
  const hlsManifestUrl = `https://manifest.googlevideo.com/api/manifest/hls_variant/${videoId}/file/index.m3u8`
  const picked = pickYoutubePlayback(
    fakerYoutubePlayer({
      videoId,
      googlevideo,
      hlsManifestUrl,
    }),
  )
  assert.equal(picked.kind, 'hls')
  assert.equal(picked.url, hlsManifestUrl)
})

test('pickPreferredYoutubePlayback escolhe HLS do IOS mesmo com itag 18 no ANDROID', async () => {
  const videoId = fakerYoutubeVideoId()
  const googlevideo = `https://rr1---sn-host.googlevideo.com/videoplayback?id=${videoId}&itag=18`
  const hlsManifestUrl = `https://manifest.googlevideo.com/api/manifest/hls_variant/${videoId}/file/index.m3u8`
  const { pickPreferredYoutubePlayback } = await import('../src/youtubePlayer.mjs')
  const picked = pickPreferredYoutubePlayback([
    fakerYoutubePlayer({ videoId, googlevideo }),
    fakerYoutubePlayer({ videoId, url: '', hlsManifestUrl }),
  ])
  assert.equal(picked.kind, 'hls')
  assert.equal(picked.url, hlsManifestUrl)
})

test('pickYoutubePlayback recusa live sem HLS e sem mp4', () => {
  const videoId = fakerYoutubeVideoId()
  assert.throws(
    () => pickYoutubePlayback(fakerYoutubePlayer({ videoId, url: '', hlsManifestUrl: '' })),
    new RegExp(
      `player do youtube recusado: recebido nenhum mp4 com url, esperado itag 18 ou hlsManifestUrl para ${videoId}`,
    ),
  )
})
