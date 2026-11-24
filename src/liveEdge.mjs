/** HLS nativo cola na borda EVENT e pausa; fica este atraso atrás do seekable. */
export const NATIVE_LIVE_LAG_S = 8

/** Seekable maior que isso no nativo é EVENT cacheado (419h), não janela ao vivo. */
export const NATIVE_LIVE_MAX_SPAN_S = 180

function seekableBound(ranges, method) {
  if (!ranges?.length) return null
  const fn = ranges[method]
  if (typeof fn !== 'function') return null
  const value = fn.call(ranges, ranges.length - 1)
  return Number.isFinite(value) ? value : null
}

function seekableEnd(video) {
  return seekableBound(video?.seekable, 'end')
}

function seekableStart(video) {
  return seekableBound(video?.seekable, 'start') ?? 0
}

/** Instantâneo da borda ao vivo: liveSyncPosition do hls.js ou fim do seekable com atraso nativo. */
export function liveEdgeTime(video, hls) {
  const sync = hls?.liveSyncPosition
  if (Number.isFinite(sync) && sync >= 0) return sync
  const end = seekableEnd(video)
  if (end == null) return null
  if (hls) return end
  const start = seekableStart(video)
  if (end - start > NATIVE_LIVE_MAX_SPAN_S) return null
  return Math.max(start, end - NATIVE_LIVE_LAG_S)
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
