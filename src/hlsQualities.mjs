import { hlsFetchInit } from './xtreamUrls.mjs'

export const HLS_QUALITY_AUTO = 'auto'

const STREAM_INF = '#EXT-X-STREAM-INF:'

function streamInfAttrs(line) {
  const attrs = {}
  const raw = line.slice(STREAM_INF.length)
  for (const match of raw.matchAll(/([A-Z0-9-]+)=("[^"]*"|[^,]*)/gi)) {
    attrs[match[1].toUpperCase()] = match[2].replaceAll(/^"|"$/g, '')
  }
  return attrs
}

function heightOf(resolution) {
  const pair = String(resolution ?? '').split('x')
  const height = Number(pair[1] || pair[0])
  return Number.isFinite(height) ? height : 0
}

/** Rótulo 10-foot no padrão do menu Qualidade do YouTube. */
export function hlsQualityLabel({ height, frameRate } = {}) {
  const h = Math.round(Number(height) || 0)
  if (h <= 0) {
    throw new Error(`altura recusada: recebido ${JSON.stringify(height)}, esperado pixels`)
  }
  const fps = Math.round(Number(frameRate) || 0)
  const rate = fps >= 50 ? String(fps) : ''
  const hd = h >= 1080 ? ' HD' : ''
  return `${h}p${rate}${hd}`.trim()
}

function qualityId(height, frameRate) {
  const fps = Math.round(Number(frameRate) || 0)
  return fps >= 50 ? `${height}p${fps}` : `${height}p`
}

function variantFrom(inf, uri) {
  const attrs = streamInfAttrs(inf)
  const height = heightOf(attrs.RESOLUTION)
  const frameRate = Number(attrs['FRAME-RATE'] || 0)
  if (height <= 0 || !uri || uri.startsWith('#')) return null
  return {
    id: qualityId(height, frameRate),
    label: hlsQualityLabel({ height, frameRate }),
    url: uri,
    height,
    frameRate,
    bandwidth: Number(attrs.BANDWIDTH || 0),
  }
}

/** Níveis de um master HLS, maior resolução primeiro. */
export function parseHlsQualities(body) {
  if (typeof body !== 'string') {
    throw new Error(`playlist recusada: recebido ${typeof body}, esperado texto`)
  }
  const lines = body.split(/\r?\n/)
  const found = []
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith(STREAM_INF)) continue
    const variant = variantFrom(lines[i], lines[i + 1]?.trim())
    if (variant) found.push(variant)
  }
  found.sort((left, right) => right.height - left.height || right.frameRate - left.frameRate)
  return found.filter((item, index) => found.findIndex((row) => row.id === item.id) === index)
}

/** Automático (master) + os níveis da playlist. */
export function withAutoQuality(qualities, masterUrl) {
  if (typeof masterUrl !== 'string' || !masterUrl.includes('.m3u8')) {
    throw new Error(`master recusado: recebido ${JSON.stringify(masterUrl)}, esperado URL .m3u8`)
  }
  return [
    { id: HLS_QUALITY_AUTO, label: 'Automático', url: masterUrl, height: 0, frameRate: 0 },
    ...(qualities ?? []),
  ]
}

/** Baixa o master e devolve os STREAM-INF. */
export async function loadHlsQualities(url, fetchFn) {
  if (typeof fetchFn !== 'function') {
    throw new Error(`fetch recusado: recebido ${typeof fetchFn}, esperado função`)
  }
  const response = await fetchFn(url, hlsFetchInit())
  if (!response?.ok) {
    throw new Error(
      `hls qualidade recusada: recebido HTTP ${response?.status}, esperado 200 para ${url}`,
    )
  }
  return parseHlsQualities(await response.text())
}
