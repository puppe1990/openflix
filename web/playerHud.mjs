import { fullscreenButtonLabel } from '../src/fullscreen.mjs'
import { applyPlayerMediaAction, playerMediaAction } from '../src/playerKeys.mjs'
import {
  cinemaBrandLabel,
  nextPlaybackRate,
  playbackRateLabel,
  playerClockRange,
  playerHudChrome,
  playerHudProgress,
  PLAYER_SEEK_DELTA,
  playerSeekTarget,
  playerVolumeLabel,
  playerVolumePercent,
} from '../src/playerHud.mjs'
import { playerHudShouldHide } from '../src/playerHudIdle.mjs'
import {
  hudBrandClass,
  hudChipClass,
  hudClockClass,
  hudIconBtnClass,
  hudNextClass,
  hudOverlayClass,
  hudPauseClass,
  hudTitleClass,
  hudToolbarClass,
  hudTopClass,
  hudVolumeClass,
  hudVolumeLabelClass,
  hudVolumeSliderClass,
  liveBadgeClass,
} from '../src/tvSkin.mjs'
import { BRAND } from './config.mjs'
import { el } from './dom.mjs'
import {
  ICON_BACK,
  ICON_FULLSCREEN,
  ICON_PAUSE,
  ICON_PLAY,
  ICON_SKIP_BACK,
  ICON_SKIP_FORWARD,
  ICON_VOLUME,
  ICON_VOLUME_MUTED,
  iconSvg,
} from './icons.mjs'

const hudState = new WeakMap()

function stored(frame, extra = {}) {
  const prev = hudState.get(frame) ?? {}
  const next = {
    ...prev,
    ...extra,
    item: extra.item ?? prev.item,
    catalogKind: extra.catalogKind ?? prev.catalogKind,
    qualityLabel: extra.qualityLabel ?? prev.qualityLabel ?? '',
    onBack: extra.onBack ?? prev.onBack,
    onFullscreen: extra.onFullscreen ?? prev.onFullscreen,
    onNext: extra.onNext ?? prev.onNext,
  }
  hudState.set(frame, next)
  return next
}

function chromeOf(frame, video) {
  const model = hudState.get(frame) ?? {}
  return playerHudChrome({
    catalogKind: model.catalogKind,
    item: model.item,
    duration: video?.duration,
  })
}

function iconButton(icon, label, extraClass = '') {
  const button = el('button', extraClass ? `${hudIconBtnClass()} ${extraClass}` : hudIconBtnClass())
  button.type = 'button'
  button.setAttribute('aria-label', label)
  button.append(iconSvg(icon, 22))
  return button
}

function skipButton(video, delta) {
  const back = delta < 0
  const label = back ? 'Voltar 10 segundos' : 'Avançar 10 segundos'
  const button = iconButton(back ? ICON_SKIP_BACK : ICON_SKIP_FORWARD, label)
  button.dataset.playerSkip = String(delta)
  const mark = el('span', 'absolute -bottom-0.5 text-[9px] font-bold', '10')
  button.className = `${button.className} relative`
  button.append(mark)
  button.addEventListener('click', () => seekBy(video, delta))
  return button
}

function togglePlay(video) {
  applyPlayerMediaAction(video, 'toggle-play')
}

function isHudChrome(node) {
  return Boolean(
    node?.closest?.('button, input, a, [data-player-progress], [data-player-volume-cluster]'),
  )
}

function seekBy(video, delta) {
  video.currentTime = playerSeekTarget({
    current: video.currentTime,
    duration: video.duration,
    delta,
  })
}

function seekOnBar(video, bar, event) {
  const duration = video.duration
  if (!Number.isFinite(duration) || duration <= 0) return
  const rect = bar.getBoundingClientRect()
  if (rect.width <= 0) return
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  video.currentTime = ratio * duration
}

function brandPill() {
  const brand = el('span', hudBrandClass())
  brand.dataset.playerBrand = '1'
  const dot = el('span', 'h-1.5 w-1.5 rounded-full bg-accent')
  brand.append(dot, document.createTextNode(` ${cinemaBrandLabel(BRAND)}`))
  return brand
}

function titleBlock(item) {
  const meta = el('div', 'min-w-0')
  const heading = el('div', 'flex flex-wrap items-center gap-3')
  const title = el('h1', hudTitleClass(), item?.name ?? '')
  title.dataset.playerName = '1'
  const badge = el('span', liveBadgeClass())
  badge.dataset.playerBadge = '1'
  heading.append(title, badge)
  const chips = el('div', 'mt-2 flex flex-wrap items-center gap-1.5')
  chips.dataset.playerChips = '1'
  meta.append(heading, chips)
  return meta
}

function hudTop(opts) {
  const row = el('div', hudTopClass())
  const left = el('div', 'flex min-w-0 items-start gap-3')
  const back = iconButton(ICON_BACK, 'Voltar')
  back.dataset.playerBack = '1'
  back.addEventListener('click', () => opts.onBack?.())
  left.append(back, titleBlock(opts.item))
  const right = el('div', 'flex shrink-0 items-center gap-2')
  right.append(brandPill())
  if (opts.actions?.fav) right.append(opts.actions.fav)
  row.append(left, right)
  return row
}

function hudCenter(video, opts) {
  const wrap = el(
    'div',
    'pointer-events-none flex flex-1 flex-col items-center justify-center gap-4',
  )
  const pause = el('button', hudPauseClass())
  pause.type = 'button'
  pause.dataset.playerPause = '1'
  pause.addEventListener('click', () => togglePlay(video))
  const skipIntro = el('button', `${hudNextClass()} self-end mr-8`, 'Pular abertura')
  skipIntro.type = 'button'
  skipIntro.dataset.skipIntro = '1'
  skipIntro.hidden = true
  skipIntro.addEventListener('click', () => {
    const end = Number(opts.item?.introEnd)
    if (Number.isFinite(end) && end > 0) video.currentTime = end
  })
  wrap.append(pause, skipIntro)
  return wrap
}

function progressBar(video) {
  const bar = el('div', 'relative mx-6 h-1 cursor-pointer rounded-full bg-white/25')
  bar.dataset.playerProgress = '1'
  const fill = el('div', 'h-full rounded-full bg-accent')
  fill.dataset.playerProgressFill = '1'
  const thumb = el(
    'div',
    'absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_0_4px_rgba(229,9,20,0.28)]',
  )
  thumb.dataset.playerProgressThumb = '1'
  bar.append(fill, thumb)
  bar.addEventListener('click', (event) => seekOnBar(video, bar, event))
  return bar
}

function volumeTrackFill(percent) {
  return `linear-gradient(to right, var(--color-accent) ${percent}%, rgba(255,255,255,0.35) ${percent}%)`
}

function syncVolumeCluster(root, video) {
  const slider = root.querySelector('[data-player-volume]')
  const mute = root.querySelector('[data-player-mute]')
  const label = root.querySelector('[data-player-volume-label]')
  const silent = video.muted || video.volume === 0
  const percent = playerVolumePercent({ volume: video.volume, muted: video.muted })
  if (slider) {
    slider.value = String(silent ? 0 : video.volume)
    slider.style.background = volumeTrackFill(percent)
  }
  if (mute) {
    mute.replaceChildren(iconSvg(silent ? ICON_VOLUME_MUTED : ICON_VOLUME, 28))
    mute.setAttribute('aria-label', silent ? 'Ativar som' : 'Mudo')
  }
  if (label) label.textContent = playerVolumeLabel({ volume: video.volume, muted: video.muted })
}

function volumeControl(video) {
  const wrap = el('div', hudVolumeClass())
  wrap.dataset.playerVolumeCluster = '1'
  const mute = iconButton(ICON_VOLUME, 'Mudo')
  mute.dataset.playerMute = '1'
  mute.addEventListener('click', () => {
    applyPlayerMediaAction(video, 'mute')
    syncVolumeCluster(wrap, video)
  })
  const slider = el('input', hudVolumeSliderClass())
  slider.type = 'range'
  slider.min = '0'
  slider.max = '1'
  slider.step = '0.05'
  slider.dataset.playerVolume = '1'
  slider.setAttribute('aria-label', 'Volume')
  slider.addEventListener('input', () => {
    video.volume = Number(slider.value)
    video.muted = video.volume === 0
    syncVolumeCluster(wrap, video)
  })
  const label = el('span', hudVolumeLabelClass(), '100%')
  label.dataset.playerVolumeLabel = '1'
  wrap.append(mute, slider, label)
  return wrap
}

function toolbar(opts) {
  const bar = el('div', hudToolbarClass())
  bar.dataset.playerToolbar = '1'
  const actions = opts.actions ?? {}
  if (actions.goLive) bar.append(actions.goLive)
  if (actions.sidecar) bar.append(actions.sidecar)
  const rate = el('button', `${hudIconBtnClass()} min-w-12 font-sans text-[13px] font-bold`, '1.0x')
  rate.type = 'button'
  rate.dataset.playerRate = '1'
  bar.append(rate)
  const full = iconButton(ICON_FULLSCREEN, fullscreenButtonLabel(false))
  full.dataset.fullscreen = '1'
  full.append(el('span', 'sr-only', fullscreenButtonLabel(false)))
  full.addEventListener('click', () => opts.onFullscreen?.())
  bar.append(full)
  return bar
}

function nextEpisodeButton(opts) {
  const next = el('button', hudNextClass(), 'Próximo episódio')
  next.type = 'button'
  next.dataset.nextEpisode = '1'
  next.hidden = true
  next.addEventListener('click', () => opts.onNext?.())
  return next
}

function transport(video) {
  const left = el('div', 'flex min-w-0 items-center gap-1')
  const pause = iconButton(ICON_PAUSE, 'Pausar')
  pause.dataset.playerPause = '1'
  pause.addEventListener('click', () => togglePlay(video))
  const clock = el('span', hudClockClass(), '00:00 / --:--')
  clock.dataset.playerClock = '1'
  left.append(
    pause,
    skipButton(video, -PLAYER_SEEK_DELTA),
    skipButton(video, PLAYER_SEEK_DELTA),
    volumeControl(video),
    clock,
  )
  return left
}

function hudBottom(video, opts) {
  const wrap = el('div', 'pointer-events-auto flex flex-col gap-3 px-2 pb-5')
  const row = el('div', 'flex items-center gap-3 px-4')
  const right = el('div', 'ml-auto flex items-center gap-2')
  right.append(nextEpisodeButton(opts), toolbar(opts))
  row.append(transport(video), right)
  wrap.append(progressBar(video), row)
  return wrap
}

function paintPause(overlay, video) {
  const paused = video.paused
  for (const button of overlay.querySelectorAll('[data-player-pause]')) {
    const big = button.className.includes('h-[4.5rem]')
    button.replaceChildren(iconSvg(paused ? ICON_PLAY : ICON_PAUSE, big ? 32 : 22))
    button.setAttribute('aria-label', paused ? 'Reproduzir' : 'Pausar')
  }
}

function paintClock(overlay, video) {
  const clock = overlay.querySelector('[data-player-clock]')
  if (!clock) return
  const now = Number.isFinite(video.currentTime) ? video.currentTime : 0
  clock.textContent = playerClockRange(now, video.duration)
}

function paintProgress(overlay, video) {
  const bar = overlay.querySelector('[data-player-progress]')
  if (!bar) return
  const progress = playerHudProgress({
    current: Number.isFinite(video.currentTime) ? video.currentTime : 0,
    duration: video.duration,
  })
  const fill = bar.querySelector('[data-player-progress-fill]')
  const thumb = bar.querySelector('[data-player-progress-thumb]')
  const pct = `${Math.round(progress.ratio * 1000) / 10}%`
  if (fill) fill.style.width = pct
  if (thumb) thumb.style.left = pct
  bar.classList.toggle('pointer-events-none', !progress.seekable)
}

function paintSkip(overlay, chrome) {
  for (const button of overlay.querySelectorAll('[data-player-skip]')) {
    button.hidden = !chrome.canSkip
  }
}

function paintRate(overlay, video, chrome) {
  const rate = overlay.querySelector('[data-player-rate]')
  if (!rate) return
  rate.hidden = !chrome.canRate
  rate.textContent = playbackRateLabel(video.playbackRate || 1)
}

function paintOptional(overlay, chrome, item) {
  const intro = overlay.querySelector('[data-skip-intro]')
  if (intro) {
    intro.hidden = !chrome.skipIntro
    const end = Number(item?.introEnd)
    if (chrome.skipIntro && Number.isFinite(end)) {
      intro.textContent = `Pular abertura`
    }
  }
  const next = overlay.querySelector('[data-next-episode]')
  if (next) next.hidden = !chrome.nextEpisode
}

function paintTitle(overlay, item, chrome, qualityLabel) {
  const name = overlay.querySelector('[data-player-name]')
  if (name) name.textContent = item?.name ?? ''
  const badge = overlay.querySelector('[data-player-badge]')
  if (badge) {
    badge.textContent = chrome.badge
    badge.hidden = !chrome.badge
  }
  const chips = overlay.querySelector('[data-player-chips]')
  if (!chips) return
  chips.replaceChildren()
  if (qualityLabel) chips.append(el('span', hudChipClass(), qualityLabel))
}

function paintVolume(overlay, video) {
  syncVolumeCluster(overlay, video)
}

function wireHud(frame, video) {
  const overlay = frame.querySelector('[data-player-hud]')
  overlay?.addEventListener('click', (event) => {
    if (isHudChrome(event.target)) return
    togglePlay(video)
  })
  overlay?.querySelector('[data-player-rate]')?.addEventListener('click', () => {
    video.playbackRate = nextPlaybackRate(video.playbackRate || 1)
  })
  if (video.dataset.hudWired === '1') return
  video.dataset.hudWired = '1'
  const paint = () => paintPlayerHud(frame, video)
  video.addEventListener('timeupdate', paint)
  video.addEventListener('loadedmetadata', paint)
  video.addEventListener('play', paint)
  video.addEventListener('pause', paint)
  video.addEventListener('volumechange', paint)
  video.addEventListener('ratechange', paint)
}

/** Liga/desliga o chrome do cinema (`data-hud-idle`). */
export function applyPlayerHudIdle(overlay, hidden) {
  if (!overlay) return
  overlay.toggleAttribute('data-hud-idle', hidden === true)
  overlay.setAttribute('aria-hidden', hidden === true ? 'true' : 'false')
}

/** Some o HUD se o vídeo toca sem interação; devolve se escondeu. */
export function hidePlayerHudIfIdle(frame, video, extra = {}) {
  const overlay = frame?.querySelector('[data-player-hud]')
  if (!overlay || !video) return false
  const hidden = playerHudShouldHide({
    paused: extra.paused ?? video.paused,
    pinned: extra.pinned ?? Boolean(frame.querySelector('[data-quality-panel]')),
    idleMs: extra.idleMs ?? 0,
  })
  applyPlayerHudIdle(overlay, hidden)
  return hidden
}

function bumpHud(frame) {
  const model = stored(frame, { lastActivity: Date.now() })
  applyPlayerHudIdle(frame.querySelector('[data-player-hud]'), false)
  return model
}

function tickHudIdle(frame, video) {
  const model = hudState.get(frame) ?? {}
  hidePlayerHudIfIdle(frame, video, {
    idleMs: Date.now() - (model.lastActivity ?? Date.now()),
  })
}

/** Para o timer do HUD. Testes e teardown. */
export function resetPlayerHudIdle(frame) {
  const model = frame ? hudState.get(frame) : null
  if (model?.idleTimer) clearInterval(model.idleTimer)
  if (model?.onKey) document.removeEventListener('keydown', model.onKey)
  if (frame) hudState.delete(frame)
}

function onPlayerKey(frame, video, event) {
  if (event.target.matches?.('input, textarea, select')) return
  const action = playerMediaAction(event.key)
  if (!action) return
  event.preventDefault()
  applyPlayerMediaAction(video, action)
  bumpHud(frame)
}

function wireIdle(frame, video) {
  const model = stored(frame)
  if (model.idleWired) return
  const onKey = (event) => onPlayerKey(frame, video, event)
  stored(frame, { idleWired: true, lastActivity: Date.now(), onKey })
  frame.addEventListener('mousemove', () => bumpHud(frame))
  frame.addEventListener('pointerdown', () => bumpHud(frame))
  frame.addEventListener('keydown', () => bumpHud(frame))
  document.addEventListener('keydown', onKey)
  video.addEventListener('pause', () => bumpHud(frame))
  video.addEventListener('play', () => tickHudIdle(frame, video))
  const timer = setInterval(() => tickHudIdle(frame, video), 400)
  timer.unref?.()
  stored(frame, { idleTimer: timer })
}

/** Desenha o overlay cinema em cima do <video>. */
export function mountPlayerHud(frame, video, opts) {
  frame.querySelector('[data-player-hud]')?.remove()
  stored(frame, opts)
  const overlay = el('div', hudOverlayClass())
  overlay.dataset.playerHud = '1'
  overlay.append(hudTop(opts), hudCenter(video, opts), hudBottom(video, opts))
  frame.append(overlay)
  wireHud(frame, video)
  wireIdle(frame, video)
  paintPlayerHud(frame, video, opts)
  return overlay
}

/** Atualiza relógio, barra, selo e botões que dependem do vídeo. */
export function paintPlayerHud(frame, video, extra = {}) {
  const overlay = frame.querySelector('[data-player-hud]')
  if (!overlay || !video) return
  const model = stored(frame, extra)
  const chrome = chromeOf(frame, video)
  paintTitle(overlay, model.item, chrome, model.qualityLabel)
  paintClock(overlay, video)
  paintProgress(overlay, video)
  paintSkip(overlay, chrome)
  paintRate(overlay, video, chrome)
  paintPause(overlay, video)
  paintVolume(overlay, video)
  paintOptional(overlay, chrome, model.item)
}
