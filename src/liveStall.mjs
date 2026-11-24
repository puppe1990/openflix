export const LIVE_STALL_TICKS = 2
export const LIVE_STALL_RELOAD_AFTER = 3
export const LIVE_EDGE_EPS_S = 1.5
export const LIVE_FROZEN_EPS_S = 0.15
export const LIVE_RELOAD_COOLDOWN_MS = 15_000

function inReloadCooldown(prev, now) {
  if (!prev?.reloadedAt || !Number.isFinite(now)) return false
  return now - prev.reloadedAt < LIVE_RELOAD_COOLDOWN_MS
}

/** Pausa colada no fim do seekable: a playlist nativa acabou. */
export function isDeathEdgePause({ paused, currentTime, seekableEnd } = {}) {
  if (!paused) return false
  if (!Number.isFinite(seekableEnd) || !Number.isFinite(currentTime)) return false
  return seekableEnd - currentTime <= LIVE_EDGE_EPS_S
}

/** Play sem avanço: buffer travou. */
export function isFrozenPlay({ paused, currentTime, lastTime } = {}) {
  if (paused) return false
  if (!Number.isFinite(currentTime) || !Number.isFinite(lastTime)) return false
  return Math.abs(currentTime - lastTime) < LIVE_FROZEN_EPS_S
}

function emptyTick(lastTime, reloadedAt) {
  return { lastTime, consecutive: 0, action: null, reloadedAt }
}

function stallAction(consecutive) {
  if (consecutive >= LIVE_STALL_RELOAD_AFTER) return 'reload'
  if (consecutive >= LIVE_STALL_TICKS) return 'nudge'
  return null
}

/**
 * Um tick do watchdog ao vivo.
 * @param {{ lastTime?: number, consecutive?: number, reloadedAt?: number }} prev
 * @param {{ live?: boolean, paused?: boolean, currentTime?: number, seekableEnd?: number, now?: number }} snap
 */
export function tickLiveStall(prev = {}, snap = {}) {
  const lastTime = Number.isFinite(snap.currentTime) ? snap.currentTime : (prev.lastTime ?? 0)
  const reloadedAt = prev.reloadedAt ?? 0
  if (!snap.live) return emptyTick(lastTime, reloadedAt)
  if (inReloadCooldown(prev, snap.now)) {
    return { lastTime, consecutive: prev.consecutive ?? 0, action: null, reloadedAt }
  }
  if (isDeathEdgePause(snap)) {
    return { lastTime, consecutive: (prev.consecutive ?? 0) + 1, action: 'reload', reloadedAt }
  }
  if (!isFrozenPlay({ ...snap, lastTime: prev.lastTime })) return emptyTick(lastTime, reloadedAt)
  const consecutive = (prev.consecutive ?? 0) + 1
  return { lastTime, consecutive, action: stallAction(consecutive), reloadedAt }
}

/** Aplica o tick: nudge (seek+play) ou remount do mesmo link. */
export function applyLiveStallAction(action, { seekToLive, play, rebind, url } = {}) {
  if (action === 'nudge') {
    seekToLive?.()
    play?.()
    return
  }
  if (action === 'reload') rebind(url)
}

function readLiveSnap(video, now) {
  const ranges = video?.seekable
  const end = ranges?.length ? ranges.end(ranges.length - 1) : null
  return {
    live: true,
    paused: Boolean(video?.paused),
    currentTime: video?.currentTime,
    seekableEnd: Number.isFinite(end) ? end : null,
    now: now(),
  }
}

/** Liga o watchdog no <video> ao vivo. */
export function armLiveStallWatch(
  video,
  { url, seekToLive, rebind, now = () => Date.now(), watch } = {},
) {
  const liveWatch = watch ?? createLiveStallWatch()
  liveWatch.start(
    () => readLiveSnap(video, now),
    (action) =>
      applyLiveStallAction(action, {
        seekToLive,
        play: () => video.play?.()?.catch?.(() => {}),
        rebind,
        url,
      }),
  )
  return liveWatch
}

function defaultSetInterval(fn, ms) {
  return globalThis.setInterval(fn, ms)
}

function defaultClearInterval(id) {
  globalThis.clearInterval(id)
}

/** Watchdog com timer injetável. */
export function createLiveStallWatch({
  intervalMs = 2_000,
  setIntervalFn = defaultSetInterval,
  clearIntervalFn = defaultClearInterval,
} = {}) {
  let id = null
  let prev = emptyTick(0, 0)
  function stop() {
    if (id == null) return
    clearIntervalFn(id)
    id = null
  }
  function start(readSnap, onAction) {
    stop()
    const first = readSnap()
    prev = emptyTick(first.currentTime ?? 0, 0)
    id = setIntervalFn(() => {
      const snap = readSnap()
      const next = tickLiveStall(prev, snap)
      prev = next.action === 'reload' ? { ...next, reloadedAt: snap.now ?? 0 } : next
      if (next.action) onAction(next.action)
    }, intervalMs)
  }
  return { start, stop }
}
