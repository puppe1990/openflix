import { playbackRateLabel } from './playerHud.mjs'

export const PLAYER_RATE_MIN = 0.25
export const PLAYER_RATE_MAX = 4
export const PLAYER_RATE_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

/** Lê 1,5 / 1.5x / 0.75 e prende em 0.25..4. */
export function parsePlaybackRate(raw) {
  const text = String(raw ?? '')
    .trim()
    .replace(',', '.')
    .replace(/x$/i, '')
    .trim()
  const n = Number(text)
  if (!Number.isFinite(n) || n < PLAYER_RATE_MIN || n > PLAYER_RATE_MAX) {
    throw new Error(
      `velocidade recusada: recebido ${JSON.stringify(raw)}, esperado ${PLAYER_RATE_MIN}..${PLAYER_RATE_MAX}`,
    )
  }
  return n
}

/** Opções 10-foot da caixa de velocidade. */
export function rateMenuOptions() {
  return PLAYER_RATE_OPTIONS.map((value) => ({
    id: String(value),
    value,
    label: playbackRateLabel(value),
  }))
}
