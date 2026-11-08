import { normalizePrimeCookie } from '../src/primeCookie.mjs'
import { readSecret, saveSecret, tauriInvoke } from './bridge.mjs'

export const PRIME_COOKIE_ACCOUNT = 'prime_cookie'

function memoryStore() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

/** Grava o cookie no cofre Tauri ou no sessionStorage do preview. */
export async function savePrimeCookie(raw) {
  const value = normalizePrimeCookie(raw)
  if (await saveSecret(PRIME_COOKIE_ACCOUNT, value)) return value
  memoryStore()?.setItem(PRIME_COOKIE_ACCOUNT, value)
  return value
}

/** Lê o cookie guardado; null quando o convidado não colou sessão. */
export async function readPrimeCookie() {
  const fromVault = await readSecret(PRIME_COOKIE_ACCOUNT)
  if (fromVault) return fromVault
  return memoryStore()?.getItem(PRIME_COOKIE_ACCOUNT) ?? null
}

/** Copia a sessão do login oficial (webview do app) para o cofre local. */
export async function syncPrimeSession() {
  const invoke = tauriInvoke()
  if (!invoke) {
    throw new Error('sessão do prime recusada: recebido preview web, esperado app Tauri')
  }
  const header = normalizePrimeCookie(await invoke('prime_session_cookie'))
  memoryStore()?.setItem(PRIME_COOKIE_ACCOUNT, header)
  return header
}

/** Apaga a sessão do webview oficial e o cookie do cofre. */
export async function signOutPrimeSession() {
  const invoke = tauriInvoke()
  if (!invoke) {
    throw new Error('sessão do prime recusada: recebido preview web, esperado app Tauri')
  }
  await invoke('prime_sign_out')
  memoryStore()?.removeItem(PRIME_COOKIE_ACCOUNT)
}
