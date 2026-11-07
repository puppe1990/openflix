import { PRIME_ORIGIN } from '../src/primeApi.mjs'
import { tauriInvoke } from './bridge.mjs'

/** Abre link no navegador do sistema quando não há shell Tauri. */
function openInBrowser(url) {
  const open = globalThis.open
  if (typeof open !== 'function') return
  open.call(globalThis, url, '_blank', 'noopener')
}

async function invokeOrBrowser(command, args, url) {
  const invoke = tauriInvoke()
  if (!invoke) {
    openInBrowser(url)
    return false
  }
  await invoke(command, args)
  return true
}

/** Login oficial da Amazon numa janela do app (a senha nunca passa pelo OpenFlix). */
export async function openPrimeSignIn() {
  return invokeOrBrowser('prime_sign_in', {}, PRIME_ORIGIN)
}

/** Player oficial do título na janela do app; o DRM roda no site da Amazon. */
export async function openPrimePlayer(url) {
  return invokeOrBrowser('prime_open_player', { url }, url)
}

/** Mesmo título no navegador do sistema, quando a janela do app não servir. */
export async function openPrimeBrowser(url) {
  return invokeOrBrowser('prime_open_external', { url }, url)
}
