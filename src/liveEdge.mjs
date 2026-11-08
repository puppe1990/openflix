function seekableEnd(video) {
  const ranges = video?.seekable
  if (!ranges?.length) return null
  const end = ranges.end(ranges.length - 1)
  return Number.isFinite(end) ? end : null
}

/** Instantâneo da borda ao vivo: liveSyncPosition do hls.js ou fim do seekable. */
export function liveEdgeTime(video, hls) {
  const sync = hls?.liveSyncPosition
  if (Number.isFinite(sync) && sync >= 0) return sync
  return seekableEnd(video)
}

/** Pula o vídeo para a borda ao vivo. Devolve false quando ainda não há borda. */
export function seekToLiveEdge(video, hls) {
  if (!video) {
    throw new Error(`video recusado: recebido ${video}, esperado elemento`)
  }
  const edge = liveEdgeTime(video, hls)
  if (edge == null) return false
  video.currentTime = edge
  return true
}
