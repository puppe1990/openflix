import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerPassword, fakerPortalHost, fakerUsername } from './factories.mjs'
import {
  LIVE_HLS_TIME_S,
  LIVE_HLS_WINDOW_SEGMENTS,
  ffmpegLiveHlsArgs,
  parseHlsMediaPlaylist,
  rewriteLiveHlsWindow,
} from '../src/liveHlsWindow.mjs'

beforeEach(() => {
  faker.seed(62)
})

function livePlaylistUrl() {
  return `http://${fakerPortalHost()}/live/${fakerUsername()}/${fakerPassword()}/62.m3u8`
}

function eventPlaylist({ count, sequence = 0, duration = 8, dir }) {
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    '#EXT-X-TARGETDURATION:10',
    `#EXT-X-MEDIA-SEQUENCE:${sequence}`,
    '#EXT-X-PLAYLIST-TYPE:EVENT',
  ]
  for (let i = 0; i < count; i += 1) {
    lines.push(`#EXTINF:${duration}.0,`)
    lines.push(`${dir}/seg${sequence + i}.ts`)
  }
  return `${lines.join('\n')}\n`
}

test('parseHlsMediaPlaylist lê sequência, tipo EVENT e segmentos relativos', () => {
  const dir = `http://${fakerPortalHost()}/hls`
  const sequence = faker.number.int({ min: 10, max: 40 })
  const text = eventPlaylist({ count: 3, sequence, dir })
  const parsed = parseHlsMediaPlaylist(text)
  assert.equal(parsed.mediaSequence, sequence)
  assert.equal(parsed.playlistType, 'EVENT')
  assert.equal(parsed.targetDuration, 10)
  assert.equal(parsed.segments.length, 3)
  assert.equal(parsed.segments[0].uri, `${dir}/seg${sequence}.ts`)
  assert.equal(parsed.segments[0].duration, 8)
})

test('rewriteLiveHlsWindow corta o EVENT enorme para a janela ao vivo', () => {
  const playlistUrl = livePlaylistUrl()
  const dir = playlistUrl.replace(/\/[^/]+$/, '')
  const sequence = faker.number.int({ min: 100, max: 400 })
  const count = faker.number.int({ min: 12, max: 20 })
  const text = eventPlaylist({ count, sequence, dir })
  const out = rewriteLiveHlsWindow(text, { playlistUrl, windowSegments: 3 })
  const parsed = parseHlsMediaPlaylist(out)
  assert.equal(parsed.playlistType, null)
  assert.equal(parsed.segments.length, 3)
  assert.equal(parsed.mediaSequence, sequence + count - 3)
  assert.equal(out.includes('#EXT-X-ENDLIST'), false)
  assert.equal(out.includes('#EXT-X-PLAYLIST-TYPE'), false)
  const last = `${dir}/seg${sequence + count - 1}.ts`
  assert.equal(parsed.segments.at(-1).uri, last)
})

test('rewriteLiveHlsWindow resolve segmento relativo contra a URL do manifesto', () => {
  const playlistUrl = livePlaylistUrl()
  const sequence = faker.number.int({ min: 1, max: 9 })
  const text = [
    '#EXTM3U',
    '#EXT-X-TARGETDURATION:8',
    `#EXT-X-MEDIA-SEQUENCE:${sequence}`,
    '#EXTINF:8.0,',
    'a.ts',
    '#EXTINF:8.0,',
    'b.ts',
  ].join('\n')
  const out = rewriteLiveHlsWindow(text, { playlistUrl, windowSegments: 2 })
  const parsed = parseHlsMediaPlaylist(out)
  const base = playlistUrl.replace(/\/[^/]+$/, '')
  assert.equal(parsed.segments[0].uri, `${base}/a.ts`)
  assert.equal(parsed.segments[1].uri, `${base}/b.ts`)
})

test('rewriteLiveHlsWindow recusa playlist sem segmento', () => {
  assert.throws(
    () =>
      rewriteLiveHlsWindow('#EXTM3U\n#EXT-X-TARGETDURATION:8\n', {
        playlistUrl: livePlaylistUrl(),
      }),
    /playlist recusada/,
  )
})

test('janela padrão cabe em poucos segmentos de live', () => {
  assert.equal(LIVE_HLS_WINDOW_SEGMENTS, 6)
  assert.equal(LIVE_HLS_TIME_S, 10)
})

test('ffmpeg live HLS copia o fluxo e mantém janela curta', () => {
  const src = livePlaylistUrl()
  const dir = `/tmp/openflix-live-hls/${faker.string.alphanumeric(8)}`
  const args = ffmpegLiveHlsArgs({ src, dir })
  assert.equal(args[args.indexOf('-user_agent') + 1], 'iptv_smarters_player_lite')
  assert.equal(args[args.indexOf('-i') + 1], src)
  assert.equal(args.includes('copy'), true)
  assert.equal(args.includes('event'), false)
  assert.equal(args[args.indexOf('-hls_time') + 1], '10')
  assert.equal(args[args.indexOf('-hls_list_size') + 1], '6')
  assert.equal(args[args.indexOf('-hls_flags') + 1], 'independent_segments')
  assert.equal(args.at(-1), `${dir}/index.m3u8`)
})
