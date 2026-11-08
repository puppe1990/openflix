const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/

function assertVideoId(videoId) {
  if (!VIDEO_ID.test(String(videoId ?? ''))) {
    throw new Error(
      `url do youtube recusada: recebido ${videoId}, esperado videoId de 11 caracteres`,
    )
  }
  return videoId
}

/** URL do proxy local: `.mp4` progressivo ou `.m3u8` da live. */
export function youtubeProxyUrl(base, videoId, kind = 'progressive') {
  const id = assertVideoId(videoId)
  const origin = String(base ?? '')
  if (!origin.startsWith('http://127.0.0.1')) {
    throw new Error(`url do youtube recusada: recebido ${origin}, esperado http://127.0.0.1`)
  }
  const ext = kind === 'hls' ? 'm3u8' : 'mp4'
  return `${origin.replace(/\/$/, '')}/video/${id}.${ext}`
}

/** Item do player OpenFlix: name/icon/url apontando para o proxy. */
export function playableYoutubeItem(card, proxyBase, playback) {
  const videoId = assertVideoId(card?.videoId)
  const kind = playback?.kind === 'hls' ? 'hls' : 'progressive'
  return {
    id: videoId,
    name: card.title || videoId,
    icon: card.coverUrl || '',
    url: youtubeProxyUrl(proxyBase, videoId, kind),
  }
}
