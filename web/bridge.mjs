import { xtreamFetchInit } from '../src/xtreamUrls.mjs'

/** Ponte com os comandos do shell Tauri e o storage do webview. */
export function tauriInvoke() {
  const invoke = globalThis.__TAURI__?.core?.invoke
  return typeof invoke === 'function' ? invoke : null
}

/** Listener de eventos do shell (`youtube-session`). */
export function tauriListen() {
  const listen = globalThis.__TAURI__?.event?.listen
  return typeof listen === 'function' ? listen : null
}

/** Retorna o fetch nativo do Tauri (sem CORS) ou null. */
export function tauriFetch() {
  const http = globalThis.__TAURI__?.http
  return typeof http?.fetch === 'function' ? http.fetch : null
}

/** localStorage protegido contra acesso negado. */
export function localStore() {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function hasUserAgent(init) {
  const headers = init?.headers
  if (!headers) return false
  return Boolean(headers['User-Agent'] || headers['user-agent'])
}

/** fetch do shell quando existe, senão o global. player_api usa Life TV; HLS pode trazer o UA de player. */
export function webFetch() {
  const inner = tauriFetch() ?? globalThis.fetch.bind(globalThis)
  return (url, init) => inner(url, hasUserAgent(init) ? init : xtreamFetchInit(init))
}

/** Grava a senha no cofre local; false quando não há shell. */
export async function saveSecret(account, value) {
  const invoke = tauriInvoke()
  if (!invoke) return false
  try {
    await invoke('secret_set', { account, value })
    return true
  } catch {
    return false
  }
}

/** Lê a senha do cofre local; null quando ausente. */
export async function readSecret(account) {
  const invoke = tauriInvoke()
  if (!invoke) return null
  try {
    return await invoke('secret_get', { account })
  } catch {
    return null
  }
}

/** Lê o seed local de ajustes (nome, portal, usuário, candidatos). */
export async function readSeed() {
  const invoke = tauriInvoke()
  if (!invoke) return null
  try {
    const raw = await invoke('seed_read')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
