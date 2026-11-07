import { playlistChipClass } from '../src/tvSkin.mjs'
import { BRAND } from './config.mjs'
import { renderCatalog, renderHome, renderTabs } from './catalogView.mjs'
import { byId } from './dom.mjs'
import { renderPlayer } from './playerView.mjs'
import { renderPrime } from './primeView.mjs'
import { renderSpinner } from './spinnerView.mjs'
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
  for (const playlist of playlistStore.list()) {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.playlistId = playlist.id
    button.textContent = playlist.name
    button.className = playlistChipClass(playlist.id === state.playlistId)
    list.append(button)
  }
}

function renderSettings() {
  byId('settings').hidden = state.shell.screen !== 'settings'
  renderSavedPlaylists()
}

/** Redesenha todas as seções visíveis a partir do estado. */
export function renderAll() {
  renderHome()
  renderCatalog()
  renderPlayer()
  renderPrime()
  renderSettings()
  renderTabs()
  renderSignal()
  renderSpinner()
  byId('error').textContent = state.errorText
}
