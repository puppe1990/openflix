import { attachHlsPlayback, preferNativeHls } from '../src/hlsPlayback.mjs'
import {
  isPlayingVideo,
  restorePlayerFromPip,
  shouldPictureInPicture,
} from '../src/pictureInPicture.mjs'
import { resolvePlayerSource } from '../src/playerSource.mjs'
import { watchCardFromItem } from '../src/watchCard.mjs'
import { redactUrl } from '../src/xtreamUrls.mjs'
import { goBack } from '../src/tvShell.mjs'
import { actionClass, ghostClass, playerNoteClass, playerUrlClass } from '../src/tvSkin.mjs'
import { tauriInvoke, webFetch } from './bridge.mjs'
import { byId, el } from './dom.mjs'
import {
  exitPlayerFullscreen,
  resetPlayerFullscreen,
  togglePlayerFullscreen,
} from './fullscreen.mjs'
import { ICON_HEART, iconSvg } from './icons.mjs'
import { mountPlayerHud, paintPlayerHud, resetPlayerHudIdle } from './playerHud.mjs'
import { openPrimeVideo } from './primeVideo.mjs'
import {
  emptyQualityState,
  HLS_QUALITY_AUTO,
  hydratePlayerQualities,
  qualityPlaybackUrl,
  resetQualityState,
  syncPlayerQuality,
} from './playerQuality.mjs'
import { ensureEpg, ensureSeriesUrl, epgBlock } from './playerEpg.mjs'
import { playUrl } from './session.mjs'
import { transitionTo } from './screenFlow.mjs'
import { state } from './state.mjs'
import { favStore, historyStore, resumeStore } from './stores.mjs'

let hlsEngine = null
let pipWired = false

/** Injeta o engine hls.js (webview Tauri). */
export function setHlsEngine(Hls) {
  hlsEngine = Hls
}

function emptyHeld() {
  return {
    url: '',
    video: null,
    session: null,
    frame: null,
    item: null,
    catalogKind: null,
    ...emptyQualityState(),
  }
}

let held = emptyHeld()

function hudQualityLabel() {
  if (!held.qualityId || held.qualityId === HLS_QUALITY_AUTO) return ''
  return held.qualities.find((row) => row.id === held.qualityId)?.label ?? ''
}

function paintHud() {
  if (!held.frame || !held.video) return
  paintPlayerHud(held.frame, held.video, {
    item: held.item,
    catalogKind: held.catalogKind ?? state.shell.catalogKind,
    qualityLabel: hudQualityLabel(),
  })
}

function paintQuality() {
  syncPlayerQuality(held.frame, {
    qualities: held.qualities,
    masterUrl: held.masterUrl,
    selectedId: held.qualityId,
    open: held.qualityOpen,
    onToggle() {
      held.qualityOpen = !held.qualityOpen
      paintQuality()
    },
    onPick: applyQuality,
    onClose() {
      held.qualityOpen = false
      paintQuality()
    },
  })
  paintHud()
}

function applyQuality(id) {
  const picked = qualityPlaybackUrl(held, id)
  if (!picked || !held.video) return
  held.qualityId = id
  held.qualityOpen = false
  paintQuality()
  if (picked.url === held.url && held.session) return
  held.session?.destroy?.()
  held.session = null
  held.url = ''
  const source = resolvePlayerSource(picked.url, {
    canPlay: (type) => held.video.canPlayType(type),
  })
  bindHlsOrProgressive(held.video, picked.url, source)
  held.session?.seekToLive?.()
}

/** Fecha o overlay Qualidade; true se consumiu o Escape. */
export function closePlayerQuality() {
  if (!held.qualityOpen) return false
  held.qualityOpen = false
  paintQuality()
  return true
}

function qualityFetch(url) {
  if (preferNativeHls(url, { inTauri: Boolean(tauriInvoke()) })) {
    return (href) => globalThis.fetch(href)
  }
  return webFetch()
}

async function hydrateAndPaint(url) {
  await hydratePlayerQualities(held, url, qualityFetch(url))
  paintQuality()
}

/** Solta o <video> preso entre renders. Só testes. */
export function resetPlayerMedia() {
  held.session?.destroy?.()
  held.qualityOpen = false
  paintQuality()
  hidePip()
  resetPlayerHudIdle(held.frame)
  held = emptyHeld()
  resetPlayerFullscreen()
}

function playingNow() {
  return Boolean(held.session) && isPlayingVideo(held.video)
}

function hidePip() {
  const host = byId('pip')
  if (!host) return
  host.hidden = true
  if (held.frame && held.frame.parentNode === host) host.replaceChildren()
}

function restoreFromPip() {
  if (!held.item || !held.catalogKind) return
  void transitionTo(
    restorePlayerFromPip(state.shell, {
      catalogKind: held.catalogKind,
      selectedItem: held.item,
    }),
  )
}

function wirePip(host) {
  if (pipWired) return
  pipWired = true
  host.addEventListener('click', restoreFromPip)
  host.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    restoreFromPip()
  })
}

function dockPip() {
  const host = byId('pip')
  if (!host || !held.frame) return
  if (held.video) held.video.controls = false
  if (held.frame.parentNode !== host) host.replaceChildren(held.frame)
  host.hidden = false
  host.setAttribute('role', 'button')
  host.setAttribute('aria-label', 'Voltar ao player')
  host.tabIndex = 0
  wirePip(host)
  if (held.video && held.url) startVideo(held.video, held.url)
}

function streamIdOf(item) {
  return item ? String(item.id) : ''
}

function rememberWatch(item) {
  const kind = state.shell.catalogKind
  if (!item?.id || !kind) return
  historyStore.remember(watchCardFromItem(item, kind))
}

function favLabel(on) {
  return on ? 'Remover favorito' : 'Favoritar'
}

function syncFavButtons() {
  const item = state.shell.selectedItem
  const on = item ? favStore.isFav(item.id) : false
  for (const button of document.querySelectorAll('[data-fav]')) {
    button.setAttribute('aria-pressed', String(on))
    const text = [...button.childNodes].find((node) => node.nodeType === 3)
    if (text) text.textContent = ` ${favLabel(on)}`
  }
}

function favButton(extraClass = '') {
  const item = state.shell.selectedItem
  const on = item ? favStore.isFav(item.id) : false
  const className = extraClass ? `${ghostClass()} ${extraClass}` : ghostClass()
  const button = el('button', className)
  button.type = 'button'
  button.dataset.fav = '1'
  button.setAttribute('aria-pressed', String(on))
  button.append(iconSvg(ICON_HEART, 16), document.createTextNode(` ${favLabel(on)}`))
  button.addEventListener('click', () => {
    const current = state.shell.selectedItem
    if (!current) return
    favStore.toggleFav(current.id, watchCardFromItem(current, state.shell.catalogKind))
    syncFavButtons()
  })
  return button
}

function seekResume(video, item) {
  if (state.shell.catalogKind === 'live') return
  const saved = resumeStore.load(streamIdOf(item))
  if (saved) video.currentTime = saved.positionMs / 1000
}

function saveResume(video, item) {
  if (!Number.isFinite(video.duration)) return
  resumeStore.save({
    streamId: streamIdOf(item),
    positionMs: Math.round(video.currentTime * 1000),
    durationMs: Math.round(video.duration * 1000),
  })
}

function wireVideo(video) {
  video.addEventListener('loadedmetadata', () => seekResume(video, held.item))
  video.addEventListener('timeupdate', () => saveResume(video, held.item))
  video.addEventListener('error', () => {
    const code = video.error?.code ?? '?'
    state.errorText = `stream falhou (código ${code})`
    const box = byId('error')
    if (box) box.textContent = state.errorText
  })
}

function startVideo(video, url) {
  video.play().catch((error) => {
    if (error?.name === 'NotAllowedError' || error?.name === 'AbortError') return
    state.errorText = `player recusou: ${error.message}`
    const box = byId('error')
    if (box) box.textContent = state.errorText
  })
  held.url = url
}

function bindHlsOrProgressive(video, url, source) {
  if (held.url === url && held.session) return source
  const shouldHydrate = source.kind === 'hls' && held.qualities.length === 0
  held.session?.destroy?.()
  held.session = null
  held.url = ''
  if (source.kind === 'progressive') {
    video.src = source.url
    held.session = { kind: 'progressive', destroy() {} }
    startVideo(video, url)
    paintQuality()
    return source
  }
  held.session = attachHlsPlayback(video, url, {
    Hls: hlsEngine,
    fetch: webFetch(),
    preferNative: preferNativeHls(url, { inTauri: Boolean(tauriInvoke()) }),
    canPlay: (type) => video.canPlayType(type),
    onFatalError(data) {
      state.errorText = `stream falhou (${data.type ?? 'hls'})`
      const box = byId('error')
      if (box) box.textContent = state.errorText
    },
  })
  startVideo(video, url)
  if (shouldHydrate) void hydrateAndPaint(url)
  return source
}

function playerVideo(url, item) {
  const changed = streamIdOf(item) !== streamIdOf(held.item)
  held.item = item
  held.catalogKind = state.shell.catalogKind
  if (changed) {
    rememberWatch(item)
    resetQualityState(held)
    paintQuality()
  }
  if (held.video && held.frame) {
    paintPlayerHud(held.frame, held.video, {
      item,
      catalogKind: state.shell.catalogKind,
    })
    syncGoLiveButton(held.frame)
    const source = resolvePlayerSource(url, { canPlay: (type) => held.video.canPlayType(type) })
    if (source.kind === 'hls' || source.kind === 'progressive') {
      bindHlsOrProgressive(held.video, url, source)
    }
    return { video: held.video, source, frame: held.frame }
  }
  const video = el('video', 'min-h-0 min-w-0 w-full flex-1 bg-black object-contain')
  video.id = 'player-video'
  video.controls = false
  video.playsInline = true
  video.autoplay = true
  wireVideo(video)
  const source = resolvePlayerSource(url, { canPlay: (type) => video.canPlayType(type) })
  const frame = playerFrame(video, item)
  frame.id = 'player-frame'
  held.video = video
  held.frame = frame
  if (source.kind === 'hls' || source.kind === 'progressive') {
    bindHlsOrProgressive(video, url, source)
  }
  return { video, source, frame }
}

function playingLiveUrl(url) {
  const src = held.video?.currentSrc || held.video?.getAttribute('src') || ''
  if (src && src !== url) return false
  return Boolean(held.session) && held.url === url
}

function goLive() {
  const url = playUrl()
  if (!held.video || !url) return
  if (!playingLiveUrl(url)) {
    held.session?.destroy?.()
    held.session = null
    held.url = ''
    const source = resolvePlayerSource(url, { canPlay: (type) => held.video.canPlayType(type) })
    bindHlsOrProgressive(held.video, url, source)
  }
  held.session?.seekToLive?.()
}

function goLiveButton() {
  const button = el('button', actionClass())
  button.type = 'button'
  button.dataset.goLive = '1'
  button.textContent = 'Ir ao vivo'
  button.addEventListener('click', goLive)
  return button
}

function syncGoLiveButton(frame) {
  const toolbar = frame.querySelector('[data-player-toolbar]')
  if (!toolbar) return
  const button = toolbar.querySelector('[data-go-live]')
  const live = state.shell.catalogKind === 'live'
  if (live && !button) toolbar.prepend(goLiveButton())
  if (!live && button) button.remove()
}

function playerFrame(video, item) {
  const frame = el('div', 'relative flex aspect-video flex-col overflow-hidden rounded-lg bg-black')
  const kind = state.shell.catalogKind
  frame.append(video)
  mountPlayerHud(frame, video, {
    item,
    catalogKind: kind,
    actions: {
      fav: favButton(),
      sidecar: tauriInvoke() ? sidecarButton() : null,
      prime: primeVideoButton(),
      goLive: kind === 'live' ? goLiveButton() : null,
    },
    onBack: () => void transitionTo(goBack(state.shell)),
    onFullscreen: () => void togglePlayerFullscreen(),
  })
  return frame
}

function playerNote(source) {
  if (source.kind === 'hls' && held.session?.kind === 'hlsjs') return 'HLS pelo fetch do shell'
  if (source.kind === 'hls') return 'HLS nativo do webview'
  if (source.kind === 'progressive') return 'MP4 progressivo'
  return source.reason
}

function putPlayerChrome(root, before, frame, after) {
  if (frame.parentNode === root) {
    for (const child of [...root.childNodes]) {
      if (child !== frame) child.remove()
    }
    for (const node of before) root.insertBefore(node, frame)
    for (const node of after) root.append(node)
    return
  }
  root.replaceChildren(...before, frame, ...after)
}

function openSidecar(url) {
  const invoke = tauriInvoke()
  if (!invoke) {
    state.errorText = 'player externo só existe no shell Tauri'
    state.redraw()
    return
  }
  invoke('play_sidecar', { url }).catch((error) => {
    state.errorText = `player externo recusou: ${error}`
    state.redraw()
  })
}

function sidecarButton(extraClass = '') {
  const className = extraClass ? `${ghostClass()} ${extraClass}` : ghostClass()
  const button = el('button', className)
  button.type = 'button'
  button.dataset.sidecar = '1'
  button.textContent = 'Abrir no player'
  button.addEventListener('click', () => openSidecar(held.url || playUrl()))
  return button
}

function primeVideoButton(extraClass = '') {
  const className = extraClass ? `${ghostClass()} ${extraClass}` : ghostClass()
  const button = el('button', className)
  button.type = 'button'
  button.dataset.primeVideo = '1'
  button.title = 'Abrir o Prime Video dentro do OpenFlix (login na Amazon)'
  button.textContent = 'Prime Video'
  button.addEventListener('click', openPrimeVideo)
  return button
}

function leavePlayerScreen() {
  const root = byId('player')
  const playing = playingNow()
  held.qualityOpen = false
  paintQuality()
  void exitPlayerFullscreen()
  if (shouldPictureInPicture({ screen: state.shell.screen, playing })) {
    dockPip()
    root.hidden = true
    return
  }
  hidePip()
  root.hidden = true
  held.video?.pause()
}

/** Desenha a tela do player com vídeo, nota e URL. */
export function renderPlayer() {
  const root = byId('player')
  const visible = state.shell.screen === 'player'
  if (!visible) {
    leavePlayerScreen()
    return
  }
  hidePip()
  root.hidden = false
  const item = state.shell.selectedItem
  const url = playUrl()
  const note = el('p', playerNoteClass())
  const before = []
  const after = []
  let frame = null
  if (url) {
    const media = playerVideo(url, item)
    if (media.source.kind === 'hls' || media.source.kind === 'progressive') frame = media.frame
    note.textContent = playerNote(media.source)
  } else if (state.shell.catalogKind === 'series') {
    ensureSeriesUrl(item)
    note.textContent = 'Carregando episódios…'
  } else {
    note.textContent = 'Sem URL para este item'
  }
  if (state.shell.catalogKind === 'live' && item) {
    ensureEpg(item)
    if (state.epg.listings.length) after.push(epgBlock(item))
  }
  after.push(note, el('code', playerUrlClass(), redactUrl(url)))
  if (frame) putPlayerChrome(root, before, frame, after)
  else root.replaceChildren(...before, ...after)
  syncFavButtons()
}
