import { resolvePlayerSource } from './playerSource.mjs'

/** HLS do transcode no Mac da LAN Puppe; o RK3326 só decodifica até 1920×1088. */
export const DEFAULT_TRANSCODE_ORIGIN = 'http://192.168.15.3:8793'

/** Janela HLS ao vivo no Mac; o WebView 95 não atualiza EVENT enorme do portal. */
export const DEFAULT_LIVE_ORIGIN = 'http://192.168.15.3:8794'

function trimOrigin(origin) {
  return String(origin).trim().replace(/\/+$/, '')
}

/** Origem do ffmpeg na LAN; casa pode gravar `transcodeOrigin` no bridge. */
export function transcodeOriginOf(house = globalThis.OpenFlixHouse) {
  const fromHouse = house && typeof house.transcodeOrigin === 'string' ? house.transcodeOrigin : ''
  if (fromHouse.trim()) return trimOrigin(fromHouse)
  return DEFAULT_TRANSCODE_ORIGIN
}

/** MP4/MKV no WebView do projetor passam pelo HLS 720p. */
export function shouldTranscodeProgressive({ leanback, sourceKind } = {}) {
  return leanback === true && (sourceKind === 'progressive' || sourceKind === 'sidecar')
}

/** URL do manifesto HLS no Mac; `src` é o MP4 original. */
export function transcodePlaybackUrl(src, origin = DEFAULT_TRANSCODE_ORIGIN) {
  if (typeof src !== 'string' || src.trim() === '') {
    throw new Error(`url recusada: recebida ${JSON.stringify(src)}, esperado texto`)
  }
  const parsed = new URL('/v/index.m3u8', `${trimOrigin(origin)}/`)
  parsed.searchParams.set('src', src.trim())
  return parsed.href
}

/** Origem da janela ao vivo; casa pode gravar `liveOrigin` no bridge. */
export function liveOriginOf(house = globalThis.OpenFlixHouse) {
  const fromHouse = house && typeof house.liveOrigin === 'string' ? house.liveOrigin : ''
  if (fromHouse.trim()) return trimOrigin(fromHouse)
  return DEFAULT_LIVE_ORIGIN
}

/** URL do manifesto ao vivo no Mac; `src` é o m3u8 do portal. */
export function livePlaybackUrl(src, origin = DEFAULT_LIVE_ORIGIN) {
  if (typeof src !== 'string' || src.trim() === '') {
    throw new Error(`url recusada: recebida ${JSON.stringify(src)}, esperado texto`)
  }
  const parsed = new URL('/live/index.m3u8', `${trimOrigin(origin)}/`)
  parsed.searchParams.set('src', src.trim())
  return parsed.href
}

function isXcLiveM3u8(url) {
  try {
    const parsed = new URL(url)
    return parsed.pathname.includes('/live/') && parsed.pathname.toLowerCase().endsWith('.m3u8')
  } catch {
    return false
  }
}

function isLiveSidecar(url, origin = liveOriginOf()) {
  try {
    const parsed = new URL(url)
    const root = new URL(`${trimOrigin(origin)}/`)
    return parsed.host === root.host && parsed.pathname.startsWith('/live/')
  } catch {
    return false
  }
}

/** HLS `/live/*.m3u8` no projetor passa pela janela curta no Mac. */
export function shouldRestreamLive({ leanback, sourceKind, url } = {}) {
  return leanback === true && sourceKind === 'hls' && isXcLiveM3u8(url) && !isLiveSidecar(url)
}

/** No leanback, progressivo vira HLS do transcode; live XC vira janela no Mac. */
export function resolveLeanbackSource(url, { leanback = false, canPlay, origin, liveOrigin } = {}) {
  const source = resolvePlayerSource(url, { canPlay })
  if (shouldRestreamLive({ leanback, sourceKind: source.kind, url })) {
    return resolvePlayerSource(livePlaybackUrl(url, liveOrigin ?? liveOriginOf()), { canPlay })
  }
  if (!shouldTranscodeProgressive({ leanback, sourceKind: source.kind })) return source
  return resolvePlayerSource(transcodePlaybackUrl(url, origin ?? transcodeOriginOf()), { canPlay })
}
