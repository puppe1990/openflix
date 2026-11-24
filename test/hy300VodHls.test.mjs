import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerPassword, fakerPortalHost, fakerUsername } from './factories.mjs'
import { ffmpegHlsArgs, parseVodSrc, rewriteHlsToAbsolute, vodJobId } from '../src/hy300VodHls.mjs'

beforeEach(() => {
  faker.seed(720)
})

function movieUrl() {
  return `http://${fakerPortalHost()}/movie/${fakerUsername()}/${fakerPassword()}/${faker.number.int({ min: 1000, max: 9999999 })}.mp4`
}

test('parseVodSrc lê o mp4 original da query src', () => {
  const src = movieUrl()
  const href = `http://192.168.15.3:8793/v/index.m3u8?src=${encodeURIComponent(src)}`
  assert.equal(parseVodSrc(href), src)
})

test('parseVodSrc recusa pedido sem src http', () => {
  assert.throws(() => parseVodSrc('http://192.168.15.3:8793/v/index.m3u8'), /src recusado/)
  assert.throws(
    () =>
      parseVodSrc(
        `http://192.168.15.3:8793/v/index.m3u8?src=${encodeURIComponent('ftp://x/a.mp4')}`,
      ),
    /src recusado/,
  )
})

test('ffmpeg HLS 720p usa videotoolbox e o UA do player XC', () => {
  const src = movieUrl()
  const dir = `/tmp/openflix-vod-hls/${faker.string.alphanumeric(8)}`
  const args = ffmpegHlsArgs({ src, dir })
  assert.deepEqual(args.slice(0, 3), ['-hide_banner', '-nostdin', '-y'])
  assert.equal(args.includes('-user_agent'), true)
  assert.equal(args[args.indexOf('-user_agent') + 1], 'iptv_smarters_player_lite')
  assert.equal(args[args.indexOf('-i') + 1], src)
  assert.equal(args.includes('scale=-2:720'), true)
  assert.equal(args.includes('h264_videotoolbox'), true)
  assert.equal(args.includes('yuv420p'), true)
  assert.equal(args.includes('event'), true)
  assert.equal(args.at(-1), `${dir}/index.m3u8`)
})

test('rewriteHlsToAbsolute deixa segmentos relativos no host do job', () => {
  const id = faker.string.hexadecimal({ length: 16, prefix: '' }).toLowerCase()
  const base = `http://192.168.15.3:8793/v/${id}`
  const playlist = [
    '#EXTM3U',
    '#EXT-X-TARGETDURATION:2',
    '#EXTINF:2.000,',
    'seg00000.ts',
    '#EXTINF:2.000,',
    './seg00001.ts',
  ].join('\n')
  const rewritten = rewriteHlsToAbsolute(playlist, base)
  assert.match(rewritten, new RegExp(`${base}/seg00000.ts`))
  assert.match(rewritten, new RegExp(`${base}/seg00001.ts`))
  assert.equal(rewritten.includes('#EXTM3U'), true)
})

test('vodJobId é estável e não ecoa a URL', () => {
  const src = movieUrl()
  const id = vodJobId(src)
  assert.equal(id, vodJobId(src))
  assert.equal(id.length, 16)
  assert.equal(src.includes(id), false)
})
