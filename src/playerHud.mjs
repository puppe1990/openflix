import { formatPlayerClock } from './playerClock.mjs'

export const PLAYER_SEEK_DELTA = 10
export const PLAYER_RATES = [1, 1.25, 1.5, 2]

/** Pílula da marca no HUD cinema. OpenFlix, nunca Streamflix. */
export function cinemaBrandLabel(brand) {
  const name = String(brand ?? '').trim()
  if (!name) {
    throw new Error(`marca recusada: recebido ${JSON.stringify(brand)}, esperado nome`)
  }
  return `${name.toUpperCase()} CINEMA`
}

/** Rótulo 1.0x / 0.25x da velocidade. */
export function playbackRateLabel(rate) {
  const n = Number(rate)
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error(`velocidade recusada: recebido ${JSON.stringify(rate)}, esperado número > 0`)
  }
  const hundredths = Math.round(n * 100)
  if (hundredths % 10 === 0) return `${(hundredths / 100).toFixed(1)}x`
  return `${hundredths / 100}x`
}

/** Próxima velocidade do ciclo 1 → 1.25 → 1.5 → 2. */
export function nextPlaybackRate(current) {
  const i = PLAYER_RATES.findIndex((rate) => Math.abs(rate - Number(current)) < 0.001)
  return PLAYER_RATES[(i + 1) % PLAYER_RATES.length]
}

/** Barra e relógio a partir do currentTime/duration. */
export function playerHudProgress({ current, duration } = {}) {
  const now = Number(current)
  if (!Number.isFinite(now) || now < 0) {
    throw new Error(
      `progresso recusado: recebido current ${JSON.stringify(current)}, esperado segundos >= 0`,
    )
  }
  const total = Number(duration)
  if (!Number.isFinite(total) || total <= 0) {
    return {
      ratio: 0,
      currentLabel: formatPlayerClock(now),
      durationLabel: '--:--',
      seekable: false,
    }
  }
  const clamped = Math.min(now, total)
  return {
    ratio: clamped / total,
    currentLabel: formatPlayerClock(clamped),
    durationLabel: formatPlayerClock(total),
    seekable: true,
  }
}

/** Percentual 0..100 a partir de volume HTML (0..1) e mudo. */
export function playerVolumePercent({ volume, muted } = {}) {
  const n = Number(volume)
  if (!Number.isFinite(n)) {
    throw new Error(`volume recusado: recebido ${JSON.stringify(volume)}, esperado 0..1`)
  }
  if (muted === true) return 0
  const clamped = Math.min(1, Math.max(0, n))
  return Math.round(clamped * 100)
}

/** Rótulo `40%` do cluster de volume. */
export function playerVolumeLabel(opts) {
  return `${playerVolumePercent(opts)}%`
}

/** Texto `28:45 / 54:20`. */
export function playerClockRange(current, duration) {
  const progress = playerHudProgress({ current, duration })
  return `${progress.currentLabel} / ${progress.durationLabel}`
}

/** currentTime depois de um pulo de ±N, preso em [0, duration]. */
export function playerSeekTarget({ current, duration, delta } = {}) {
  const now = Number(current)
  const total = Number(duration)
  const step = Number(delta)
  if (!Number.isFinite(now) || now < 0 || !Number.isFinite(step)) {
    throw new Error(
      `seek recusado: recebido current ${JSON.stringify(current)} delta ${JSON.stringify(delta)}, esperado segundos`,
    )
  }
  if (!Number.isFinite(total) || total <= 0) return now
  return Math.min(total, Math.max(0, now + step))
}

/** O que o HUD cinema mostra conforme o tipo do item. */
export function playerHudChrome({ catalogKind, item, duration, live = false } = {}) {
  const kind = String(catalogKind ?? '')
  // Prime ao vivo não é `catalogKind: 'live'` (o catálogo é `prime`), mas o HUD
  // precisa do mesmo bloqueio de seek/velocidade e do selo "Ao vivo".
  const isLive = kind === 'live' || Boolean(live)
  const isSeries = kind === 'series'
  const total = Number(duration)
  const liveLike = isLive || !Number.isFinite(total) || total <= 0
  const introEnd = Number(item?.introEnd)
  return {
    isLive,
    isSeries,
    seekable: !liveLike,
    canSkip: !liveLike,
    canRate: !liveLike,
    skipIntro: Number.isFinite(introEnd) && introEnd > 0,
    nextEpisode: isSeries && item?.nextEpisode != null,
    badge: isLive ? 'Ao vivo' : isSeries ? 'Série' : '',
  }
}
