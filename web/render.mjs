import {
  DEFAULT_SETTINGS_TAB,
  SETTINGS_TABS,
  settingsListsHidden,
  settingsPaneHidden,
} from '../src/settingsTabs.mjs'
import { playlistChipClass, settingsRailClass, settingsStageClass } from '../src/tvSkin.mjs'
import { BRAND } from './config.mjs'
import { renderCatalog, renderHome, renderTabs } from './catalogView.mjs'
import { byId } from './dom.mjs'
import { renderPlayer } from './playerView.mjs'
import { renderPrime } from './primeView.mjs'
import { renderSpinner } from './spinnerView.mjs'
import { renderYoutube } from './youtubeView.mjs'
import { state } from './state.mjs'
import { playlistStore } from './stores.mjs'

function renderSignal() {
  const signal = byId('signal')
  const avatar = byId('avatar')
  const current = playlistStore.list().find((item) => item.id === state.playlistId)
  const name = current?.name || BRAND
  if (signal) {
    signal.replaceChildren()
    const dot = document.createElement('span')
    dot.className = 'h-2 w-2 rounded-full bg-good'
    signal.append(dot, document.createTextNode(name))
  }
  if (avatar) avatar.textContent = name.slice(0, 1).toUpperCase()
}

function renderSavedPlaylists() {
  const list = byId('savedPlaylists')
  if (!list) return
  list.replaceChildren()
  const playlists = playlistStore.list()
  const wrap = byId('savedPlaylistsWrap')
  if (wrap) wrap.hidden = playlists.length === 0
  for (const playlist of playlists) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.playlistId = playlist.id
    button.textContent = playlist.name
    button.className = playlistChipClass(playlist.id === state.playlistId)
    list.append(button)
  }
}

function renderSettingsTabs() {
  const active = state.settingsTab || DEFAULT_SETTINGS_TAB
  const lists = byId('settingsLists')
  if (lists) lists.hidden = settingsListsHidden(active)
  for (const tab of SETTINGS_TABS) {
    const button = byId(`settings-tab-${tab.id}`)
    if (button) button.className = settingsRailClass(active === tab.id)
    const pane = byId(`settings-pane-${tab.id}`)
    if (pane) pane.hidden = settingsPaneHidden(active, tab.id)
  }
}

function renderSettings() {
  const root = byId('settings')
  root.hidden = state.shell.screen !== 'settings'
  const stage = byId('settingsStage')
  if (stage) stage.className = settingsStageClass()
  renderSavedPlaylists()
  renderSettingsTabs()
}

/** Redesenha todas as seções visíveis a partir do estado. */
export function renderAll() {
  renderHome()
  renderCatalog()
  renderPlayer()
  renderPrime()
  renderYoutube()
  renderSettings()
  renderTabs()
  renderSignal()
  renderSpinner()
  byId('error').textContent = state.errorText
}
