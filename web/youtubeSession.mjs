import { filterYoutubeCookie, normalizeYoutubeCookie } from '../src/youtubeCookie.mjs'
import { readSecret, saveSecret, tauriInvoke } from './bridge.mjs'

export const YOUTUBE_COOKIE_ACCOUNT = 'youtube_cookie'

function memoryStore() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

/** Grava o cookie no cofre Tauri ou no sessionStorage do preview. */
export async function saveYoutubeCookie(raw) {
  const value = filterYoutubeCookie(raw)
  if (await saveSecret(YOUTUBE_COOKIE_ACCOUNT, value)) return value
  memoryStore()?.setItem(YOUTUBE_COOKIE_ACCOUNT, value)
  return value
}

/** Lê o cookie guardado; null quando o convidado não colou sessão. */
export async function readYoutubeCookie() {
  const fromVault = await readSecret(YOUTUBE_COOKIE_ACCOUNT)
  if (fromVault) return fromVault
  return memoryStore()?.getItem(YOUTUBE_COOKIE_ACCOUNT) ?? null
}

/** Copia a sessão do login oficial (webview do app) para o cofre local. */
export async function syncYoutubeSession() {
  const invoke = tauriInvoke()
  if (!invoke) {
    throw new Error('youtube recusou: recebido preview web, esperado app Tauri')
  }
  const header = filterYoutubeCookie(await invoke('youtube_session_cookie'))
  memoryStore()?.setItem(YOUTUBE_COOKIE_ACCOUNT, header)
  return header
}

/** Apaga a sessão do webview oficial e o cookie do cofre. */
export async function signOutYoutubeSession() {
  const invoke = tauriInvoke()
  if (!invoke) {
    throw new Error('youtube recusou: recebido preview web, esperado app Tauri')
  }
  await invoke('youtube_sign_out')
  memoryStore()?.removeItem(YOUTUBE_COOKIE_ACCOUNT)
}

export { normalizeYoutubeCookie }
