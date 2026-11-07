import { normalizePrimeCookie } from '../src/primeCookie.mjs'
import { readSecret, saveSecret } from './bridge.mjs'

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
