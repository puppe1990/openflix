function detailsOf(payload) {
  return payload?.videoDetails ?? {}
}

function statusOf(payload) {
  return payload?.playabilityStatus ?? {}
}

function muxedFormats(payload) {
  const formats = payload?.streamingData?.formats
  return Array.isArray(formats) ? formats : []
}

function assertPlayable(payload) {
  const videoId = detailsOf(payload).videoId || ''
  const playability = statusOf(payload)
  if (playability.status && playability.status !== 'OK') {
    throw new Error(
      `player do youtube recusado: recebido ${playability.status} ${playability.reason || ''}, esperado OK para ${videoId}`.trim(),
    )
  }
  return videoId
}

function muxedFormat(payload) {
  return muxedFormats(payload).find(
    (item) => item?.url && String(item.mimeType ?? '').startsWith('video/mp4'),
  )
}

function hlsManifestUrl(payload) {
  const url = payload?.streamingData?.hlsManifestUrl
  if (typeof url !== 'string') return ''
  if (!url.startsWith('https://') || !url.includes('googlevideo.com') || !url.includes('.m3u8')) {
    return ''
  }
  return url
}

/** Escolhe o mp4 muxed com url direta (itag 18 ANDROID). Cipher fica de fora. */
export function pickMuxedProgressive(payload) {
  const videoId = assertPlayable(payload)
  const format = muxedFormat(payload)
  if (!format) {
    throw new Error(
      `player do youtube recusado: recebido nenhum mp4 com url, esperado itag 18 para ${videoId}`,
    )
  }
  return {
    videoId,
    title: detailsOf(payload).title || '',
    itag: format.itag,
    mimeType: format.mimeType,
    url: format.url,
  }
}

/** HLS (`hlsManifestUrl`) na frente do itag 18 — o menu Qualidade precisa dos STREAM-INF. */
export function pickYoutubePlayback(payload) {
  const videoId = assertPlayable(payload)
  const url = hlsManifestUrl(payload)
  if (url) {
    return {
      kind: 'hls',
      videoId,
      title: detailsOf(payload).title || '',
      url,
    }
  }
  const format = muxedFormat(payload)
  if (format) {
    return { kind: 'progressive', ...pickMuxedProgressive(payload) }
  }
  throw new Error(
    `player do youtube recusado: recebido nenhum mp4 com url, esperado itag 18 ou hlsManifestUrl para ${videoId}`,
  )
}

/** Entre vários /player, fica com o HLS se algum cliente tiver. */
export function pickPreferredYoutubePlayback(payloads) {
  if (!Array.isArray(payloads)) {
    throw new Error(
      `player do youtube recusado: recebido ${typeof payloads}, esperado lista de /player`,
    )
  }
  const found = []
  let lastError
  for (const payload of payloads) {
    try {
      found.push(pickYoutubePlayback(payload))
    } catch (error) {
      lastError = error
    }
  }
  const hls = found.find((item) => item.kind === 'hls')
  if (hls) return hls
  if (found[0]) return found[0]
  throw (
    lastError ??
    new Error(
      'player do youtube recusado: recebido nenhum /player, esperado itag 18 ou hlsManifestUrl',
    )
  )
}
