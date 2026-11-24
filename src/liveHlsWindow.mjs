import { HLS_PLAYER_USER_AGENT } from './xtreamUrls.mjs'

/** Duração alvo do segmento; o portal manda ~10s, 2s esgota o player entre rajadas. */
export const LIVE_HLS_TIME_S = 10

/** Quantos segmentos ficam na janela ao vivo (HLS nativo não atualiza EVENT enorme). */
export const LIVE_HLS_WINDOW_SEGMENTS = 6

/** argv do ffmpeg: copia o live HLS do portal para uma janela curta no Mac. */
export function ffmpegLiveHlsArgs({ src, dir }) {
  return [
    '-hide_banner',
    '-nostdin',
    '-y',
    '-loglevel',
    'error',
    '-user_agent',
    HLS_PLAYER_USER_AGENT,
    '-reconnect',
    '1',
    '-reconnect_streamed',
    '1',
    '-i',
    src,
    '-map',
    '0',
    '-c',
    'copy',
    '-f',
    'hls',
    '-hls_time',
    String(LIVE_HLS_TIME_S),
    '-hls_list_size',
    String(LIVE_HLS_WINDOW_SEGMENTS),
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    `${dir}/seg%05d.ts`,
    `${dir}/index.m3u8`,
  ]
}

function tagValue(line, name) {
  const prefix = `#${name}:`
  if (!line.startsWith(prefix)) return null
  return line.slice(prefix.length).trim()
}

/**
 * Lê um manifesto HLS de mídia (não master).
 * @param {string} text
 */
export function parseHlsMediaPlaylist(text) {
  if (typeof text !== 'string' || !text.includes('#EXTM3U')) {
    throw new Error(
      `playlist recusada: recebido ${JSON.stringify(String(text).slice(0, 40))}, esperado manifesto HLS`,
    )
  }
  const lines = text.split(/\r?\n/)
  let mediaSequence = 0
  let playlistType = null
  let targetDuration = null
  let version = null
  const segments = []
  let pendingDuration = null
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const sequence = tagValue(line, 'EXT-X-MEDIA-SEQUENCE')
    if (sequence != null) {
      mediaSequence = Number(sequence)
      continue
    }
    const type = tagValue(line, 'EXT-X-PLAYLIST-TYPE')
    if (type != null) {
      playlistType = type
      continue
    }
    const durationTag = tagValue(line, 'EXT-X-TARGETDURATION')
    if (durationTag != null) {
      targetDuration = Number(durationTag)
      continue
    }
    const versionTag = tagValue(line, 'EXT-X-VERSION')
    if (versionTag != null) {
      version = Number(versionTag)
      continue
    }
    if (line.startsWith('#EXTINF:')) {
      const dur = Number(line.slice('#EXTINF:'.length).split(',')[0])
      pendingDuration = Number.isFinite(dur) ? dur : 0
      continue
    }
    if (line.startsWith('#')) continue
    segments.push({ uri: line, duration: pendingDuration ?? 0 })
    pendingDuration = null
  }
  return { mediaSequence, playlistType, targetDuration, version, segments }
}

/**
 * Corta playlist EVENT/VOD longa para uma janela ao vivo, com URLs absolutas.
 * @param {string} text
 * @param {{ playlistUrl: string, windowSegments?: number }} opts
 */
export function rewriteLiveHlsWindow(
  text,
  { playlistUrl, windowSegments = LIVE_HLS_WINDOW_SEGMENTS } = {},
) {
  if (typeof playlistUrl !== 'string' || !/^https?:\/\//i.test(playlistUrl)) {
    throw new Error(
      `playlistUrl recusada: recebido ${JSON.stringify(playlistUrl)}, esperado URL http(s)`,
    )
  }
  const parsed = parseHlsMediaPlaylist(text)
  if (!parsed.segments.length) {
    throw new Error('playlist recusada: recebido 0 segmentos, esperado ao menos 1')
  }
  const size = Math.min(windowSegments, parsed.segments.length)
  const window = parsed.segments.slice(-size)
  const mediaSequence = parsed.mediaSequence + parsed.segments.length - size
  const lines = ['#EXTM3U']
  if (Number.isFinite(parsed.version)) lines.push(`#EXT-X-VERSION:${parsed.version}`)
  if (Number.isFinite(parsed.targetDuration)) {
    lines.push(`#EXT-X-TARGETDURATION:${parsed.targetDuration}`)
  }
  lines.push(`#EXT-X-MEDIA-SEQUENCE:${mediaSequence}`)
  for (const seg of window) {
    lines.push(`#EXTINF:${Number.isFinite(seg.duration) ? seg.duration : 0},`)
    lines.push(new URL(seg.uri, playlistUrl).href)
  }
  return `${lines.join('\n')}\n`
}
