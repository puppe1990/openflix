import { PLAYER_SEEK_DELTA, playerSeekTarget } from './playerHud.mjs'

/** Tecla do HUD cinema: play/pause, mudo ou pulo. */
export function playerMediaAction(key, { leanback, live } = {}) {
  if (key === ' ' || key === 'k' || key === 'K' || key === 'MediaPlayPause') return 'toggle-play'
  if (leanback === true && (key === 'Enter' || key === 'NumpadEnter')) return 'toggle-play'
  if (key === 'm' || key === 'M' || key === 'AudioVolumeMute') return 'mute'
  if (live === true) return null
  if (leanback === true && key === 'ArrowLeft') return 'seek-back'
  if (leanback === true && key === 'ArrowRight') return 'seek-forward'
  return null
}

/** Aplica play/pause, mudo ou pulo no <video>. */
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
  if (action === 'seek-back' || action === 'seek-forward') {
    const delta = action === 'seek-back' ? -PLAYER_SEEK_DELTA : PLAYER_SEEK_DELTA
    video.currentTime = playerSeekTarget({
      current: video.currentTime,
      duration: video.duration,
      delta,
    })
    return
  }
  throw new Error(
    `ação recusada: recebido ${JSON.stringify(action)}, esperado toggle-play, mute, seek-back ou seek-forward`,
  )
}
