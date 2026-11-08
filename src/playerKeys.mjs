/** Tecla do HUD cinema: play/pause ou mudo. */
export function playerMediaAction(key) {
  if (key === ' ' || key === 'k' || key === 'K' || key === 'MediaPlayPause') return 'toggle-play'
  if (key === 'm' || key === 'M' || key === 'AudioVolumeMute') return 'mute'
  return null
}

/** Aplica play/pause ou mudo no <video>. */
export function applyPlayerMediaAction(video, action) {
  if (!video || typeof video !== 'object') {
    throw new Error(`vídeo recusado: recebido ${JSON.stringify(video)}, esperado elemento de vídeo`)
  }
  if (action === 'toggle-play') {
    if (video.paused) {
      const playing = video.play?.()
      if (playing && typeof playing.catch === 'function') playing.catch(() => {})
    } else {
      video.pause?.()
    }
    return
  }
  if (action === 'mute') {
    video.muted = !video.muted
    if (!video.muted && video.volume === 0) video.volume = 1
    return
  }
  throw new Error(`ação recusada: recebido ${JSON.stringify(action)}, esperado toggle-play ou mute`)
}
