export const PLAYER_HUD_IDLE_MS = 2800

/** Some o chrome do cinema com o vídeo tocando e sem menu preso. */
export function playerHudShouldHide({
  paused = false,
  pinned = false,
  idleMs = 0,
  idleAfterMs = PLAYER_HUD_IDLE_MS,
} = {}) {
  if (paused === true || pinned === true) return false
  const idle = Number(idleMs)
  if (!Number.isFinite(idle) || idle < 0) {
    throw new Error(`idle do hud recusado: recebido ${JSON.stringify(idleMs)}, esperado ms >= 0`)
  }
  return idle >= idleAfterMs
}
