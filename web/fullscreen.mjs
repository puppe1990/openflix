import { fullscreenButtonLabel } from '../src/fullscreen.mjs'
import { tauriInvoke } from './bridge.mjs'

let active = false

/** Se a tela cheia do player está ligada. */
export function isPlayerFullscreen() {
  return active
}

/** Zera o teatro. Só testes e teardown. */
export function resetPlayerFullscreen() {
  active = false
  document.body?.classList.remove('is-fullscreen')
  syncButtons()
}

function syncButtons() {
  const label = fullscreenButtonLabel(active)
  for (const button of document.querySelectorAll('[data-fullscreen]')) {
    button.setAttribute('aria-label', label)
    button.setAttribute('aria-pressed', String(active))
    const text = button.querySelector('.sr-only')
    if (text) text.textContent = label
    else button.textContent = label
  }
}

function applyTheater(on) {
  document.body.classList.toggle('is-fullscreen', on)
}

function currentWindow() {
  const api = globalThis.__TAURI__
  if (typeof api?.window?.getCurrentWindow === 'function') return api.window.getCurrentWindow()
  if (typeof api?.webviewWindow?.getCurrentWebviewWindow === 'function') {
    return api.webviewWindow.getCurrentWebviewWindow()
  }
  return null
}

async function setShellFullscreen(on) {
  const win = currentWindow()
  if (win && typeof win.setFullscreen === 'function') {
    await win.setFullscreen(on)
    return
  }
  const invoke = tauriInvoke()
  if (invoke) {
    await invoke('plugin:window|set_fullscreen', { value: on })
  }
}

/** Liga ou desliga teatro + janela. */
export async function setPlayerFullscreen(on) {
  const next = on === true
  active = next
  applyTheater(active)
  syncButtons()
  try {
    await setShellFullscreen(next)
  } catch {
    /* o CSS do teatro preenche o webview mesmo se a janela recusar */
  }
}

/** Alterna a tela cheia do player. */
export function togglePlayerFullscreen() {
  return setPlayerFullscreen(!active)
}

/** Sai da tela cheia se estiver nela. */
export function exitPlayerFullscreen() {
  if (!active) return Promise.resolve()
  return setPlayerFullscreen(false)
}
