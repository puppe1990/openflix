import { createHash } from 'node:crypto'
import { HLS_PLAYER_USER_AGENT } from './xtreamUrls.mjs'

const SRC_HTTP = /^https?:\/\//i

/** Hash curto do MP4 original; vira pasta e path dos .ts. */
export function vodJobId(src) {
  return createHash('sha256').update(src).digest('hex').slice(0, 16)
}

/** Lê `?src=` de um pedido `/v/index.m3u8`. */
export function parseVodSrc(href) {
  let parsed
  try {
    parsed = new URL(href)
  } catch {
    throw new Error(`src recusado: recebida ${JSON.stringify(href)}, esperado URL http(s) com src`)
  }
  const src = parsed.searchParams.get('src') ?? ''
  if (!SRC_HTTP.test(src)) {
    throw new Error(`src recusado: recebida ${JSON.stringify(src)}, esperado URL http(s) do filme`)
  }
  return src
}

/** argv do ffmpeg: 720p H.264 + AAC, playlist EVENT que cresce. */
export function ffmpegHlsArgs({ src, dir }) {
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
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    'scale=-2:720',
    '-pix_fmt',
    'yuv420p',
    '-c:v',
    'h264_videotoolbox',
    '-b:v',
    '2500k',
    '-c:a',
    'aac',
    '-ac',
    '2',
    '-ar',
    '48000',
    '-b:a',
    '128k',
    '-f',
    'hls',
    '-hls_time',
    '2',
    '-hls_list_size',
    '0',
    '-hls_playlist_type',
    'event',
    '-hls_flags',
    'independent_segments',
    '-hls_segment_filename',
    `${dir}/seg%05d.ts`,
    `${dir}/index.m3u8`,
  ]
}

/** Segmentos relativos viram URL absoluta no job; linhas # ficam. */
export function rewriteHlsToAbsolute(playlist, base) {
  const root = String(base).replace(/\/+$/, '')
  return playlist
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return line
      if (/^https?:\/\//i.test(trimmed)) return line
      const name = trimmed.replace(/^\.\//, '')
      return `${root}/${name}`
    })
    .join('\n')
}
