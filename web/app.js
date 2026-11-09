import { shouldConsumeEscape } from '../src/fullscreen.mjs'
import { DEFAULT_SETTINGS_TAB, selectSettingsTab } from '../src/settingsTabs.mjs'
import { focusHome, goBack, handleKey, openHomeTile } from '../src/tvShell.mjs'
import { BRAND } from './config.mjs'
import { byId } from './dom.mjs'
import { tauriListen } from './bridge.mjs'
import { exitPlayerFullscreen, isPlayerFullscreen, togglePlayerFullscreen } from './fullscreen.mjs'
import { Hls } from './vendor/hls.mjs'
import { closePlayerQuality, setHlsEngine } from './playerView.mjs'
import {
  readPrimeCookie,
  savePrimeCookie,
  signOutPrimeSession,
  syncPrimeSession,
} from './primeSession.mjs'
import { syncPrimePane } from './primePane.mjs'
import { handlePrimeKey } from './primeView.mjs'
import { PRIME_SCREEN_EVENT, openPrimeVideo } from './primeVideo.mjs'
import { openPrimeSignIn } from './primeWindow.mjs'
import { renderAll } from './render.mjs'
import {
  formatYoutubeError,
  queueYoutubeSearch,
  wireYoutubeSessionListener,
} from './youtubeClient.mjs'
import {
  readYoutubeCookie,
  saveYoutubeCookie,
  signOutYoutubeSession,
  syncYoutubeSession,
} from './youtubeSession.mjs'
import { handleYoutubeKey } from './youtubeView.mjs'
import { YOUTUBE_SCREEN_EVENT, openYoutube } from './youtubeVideo.mjs'
import { openYoutubeSignIn } from './youtubeWindow.mjs'

setHlsEngine(Hls)
import {
  bootSaved,
  bootSeed,
  bootSeedLists,
  discover,
  hydrateSettingsForm,
  openSavedPlaylist,
  saveM3uPlaylist,
  savePlaylist,
  startDemo,
} from './session.mjs'
import { transitionTo } from './screenFlow.mjs'
import { setRedraw, state } from './state.mjs'
import { loadStores, playlistStore, themeStore } from './stores.mjs'
import { wireThemeToggle } from './themeView.mjs'

setRedraw(renderAll)

async function applyShell(next) {
  await transitionTo(next)
}

async function onTile(id) {
  await applyShell(openHomeTile(focusHome(state.shell, id)))
}

function goToScreen({ screen, catalogKind = null }) {
  if (screen === 'home') {
    void transitionTo(goBack(state.shell))
    return
  }
  if (screen === 'prime') {
    void transitionTo({ ...state.shell, screen: 'prime' })
    return
  }
  if (screen === 'youtube') {
    void transitionTo({ ...state.shell, screen: 'youtube' })
    return
  }
  void onTile(screen === 'settings' ? 'settings' : catalogKind)
}

async function onKey(event) {
  if (event.target.matches('input, textarea') && event.key !== 'Escape') return
  if ((event.key === 'Escape' || event.key === 'Backspace') && closePlayerQuality()) {
    event.preventDefault()
    return
  }
  if (event.key === 'Escape' && shouldConsumeEscape(isPlayerFullscreen())) {
    event.preventDefault()
    await exitPlayerFullscreen()
    return
  }
  if (state.shell.screen === 'prime' && handlePrimeKey(event.key)) {
    event.preventDefault()
    return
  }
  if (state.shell.screen === 'youtube' && handleYoutubeKey(event.key)) {
    event.preventDefault()
    return
  }
  if (
    (event.key === 'f' || event.key === 'F') &&
    state.shell.screen === 'player' &&
    !event.target.matches('input, textarea')
  ) {
    event.preventDefault()
    await togglePlayerFullscreen()
    return
  }
  const next = handleKey(state.shell, event.key)
  if (next === state.shell) return
  event.preventDefault()
  await applyShell(next)
}

function wireHomeTiles() {
  byId('home').addEventListener('click', (event) => {
    const tile = event.target.closest('[data-tile]')
    if (tile) void onTile(tile.dataset.tile)
  })
}

function wirePrimeScreen() {
  document.addEventListener(PRIME_SCREEN_EVENT, () => goToScreen({ screen: 'prime' }))
}

function wireYoutubeScreen() {
  document.addEventListener(YOUTUBE_SCREEN_EVENT, () => goToScreen({ screen: 'youtube' }))
}

async function wirePrimeCookie() {
  const field = byId('primeCookie')
  const saved = await readPrimeCookie()
  if (saved && field) field.value = saved
  byId('primeCookieBtn').addEventListener('click', async () => {
    try {
      await savePrimeCookie(field.value)
      state.errorText = ''
    } catch (error) {
      state.errorText = `prime video recusou: ${error.message}`
    }
    state.redraw()
  })
}

async function runPrimeAction(action, onDone) {
  try {
    const value = await action()
    if (onDone) onDone(value)
    state.errorText = ''
  } catch (error) {
    state.errorText = `prime video recusou: ${error.message}`
  }
  state.redraw()
}

function wirePrimeSession() {
  const field = byId('primeCookie')
  byId('primeSignInBtn').addEventListener('click', () => runPrimeAction(openPrimeSignIn))
  byId('primeSyncBtn').addEventListener('click', () =>
    runPrimeAction(syncPrimeSession, (header) => {
      field.value = header
    }),
  )
  byId('primeSignOutBtn').addEventListener('click', () =>
    runPrimeAction(signOutPrimeSession, () => {
      field.value = ''
    }),
  )
}

async function wireYoutubeCookie() {
  const field = byId('youtubeCookie')
  const saved = await readYoutubeCookie()
  if (saved && field) field.value = saved
  byId('youtubeCookieBtn')?.addEventListener('click', async () => {
    try {
      await saveYoutubeCookie(field.value)
      state.errorText = ''
    } catch (error) {
      state.errorText = formatYoutubeError(error)
    }
    state.redraw()
  })
}

async function runYoutubeAction(action, onDone) {
  try {
    const value = await action()
    if (onDone) onDone(value)
    state.errorText = ''
  } catch (error) {
    state.errorText = formatYoutubeError(error)
  }
  state.redraw()
}

function wireYoutubeSession() {
  const field = byId('youtubeCookie')
  byId('youtubeSignInBtn')?.addEventListener('click', () => runYoutubeAction(openYoutubeSignIn))
  byId('youtubeSyncBtn')?.addEventListener('click', () =>
    runYoutubeAction(syncYoutubeSession, (header) => {
      if (field) field.value = header
    }),
  )
  byId('youtubeSignOutBtn')?.addEventListener('click', () =>
    runYoutubeAction(signOutYoutubeSession, () => {
      if (field) field.value = ''
    }),
  )
}

function wireSettingsTabs() {
  byId('settingsTabs')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-settings-tab]')
    if (!button) return
    state.settingsTab = selectSettingsTab(button.dataset.settingsTab)
    state.redraw()
  })
}

function wireTabs() {
  for (const id of [
    'tab-inicio',
    'tab-live',
    'tab-movies',
    'tab-series',
    'tab-prime',
    'tab-youtube',
    'tab-settings',
  ]) {
    byId(id).addEventListener('click', () => {
      const button = byId(id)
      if (button.dataset.catalog) {
        goToScreen({ screen: 'catalog', catalogKind: button.dataset.catalog })
        return
      }
      goToScreen({ screen: button.dataset.screen })
    })
  }
}

async function boot() {
  state.settingsTab = DEFAULT_SETTINGS_TAB
  document.title = BRAND
  byId('brand').textContent = BRAND
  document.addEventListener('keydown', onKey)
  globalThis.window?.addEventListener('resize', () => {
    void syncPrimePane()
  })
  byId('demoBtn').addEventListener('click', startDemo)
  byId('discoverBtn').addEventListener('click', discover)
  byId('m3uBtn').addEventListener('click', saveM3uPlaylist)
  byId('primeBtn').addEventListener('click', openPrimeVideo)
  byId('youtubeBtn')?.addEventListener('click', openYoutube)
  byId('playlistForm').addEventListener('submit', savePlaylist)
  byId('search').addEventListener('input', () => {
    if (state.shell.screen === 'youtube') {
      queueYoutubeSearch(byId('search').value)
      return
    }
    renderAll()
  })
  wireHomeTiles()
  wireTabs()
  wireSettingsTabs()
  wirePrimeScreen()
  wirePrimeSession()
  wireYoutubeScreen()
  wireYoutubeSession()
  wireYoutubeSessionListener(tauriListen())
  await wirePrimeCookie()
  await wireYoutubeCookie()
  document.querySelector('a[href="#home"]')?.addEventListener('click', (event) => {
    event.preventDefault()
    goToScreen({ screen: 'home' })
  })
  byId('savedPlaylists')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-playlist-id]')
    if (button) void openSavedPlaylist(button.dataset.playlistId)
  })
  await loadStores()
  wireThemeToggle({
    store: themeStore,
    button: byId('theme'),
    root: document.documentElement,
  })
  if (await bootSaved()) return
  if (await bootSeedLists()) return
  if (await bootSeed()) return
  const warning = state.errorText
  startDemo()
  if (warning) state.errorText = warning
  else if (playlistStore.list().length > 0) {
    state.errorText = 'Playlist salva sem senha guardada: cadastre de novo.'
  }
  await hydrateSettingsForm()
  renderAll()
}

boot()
