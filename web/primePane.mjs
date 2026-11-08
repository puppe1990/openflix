import { paneRect } from '../src/primePaneRect.mjs'
import { tauriInvoke } from './bridge.mjs'
import { byId } from './dom.mjs'
import { state } from './state.mjs'

/** Placeholder do palco: o webview nativo do player oficial é posicionado sobre ele. */
export const PANE_HOST_ID = 'primePaneHost'

/** Retângulo lógico do placeholder, ou null quando ele não está visível. */
function hostRect() {
  const host = byId(PANE_HOST_ID)
  if (!host || typeof host.getBoundingClientRect !== 'function') return null
  const viewport = {
    width: globalThis.innerWidth ?? 0,
    height: globalThis.innerHeight ?? 0,
  }
  return paneRect(host.getBoundingClientRect(), viewport)
}

/**
 * Abre o título no painel embutido da própria janela do OpenFlix.
 * Devolve false no preview web, onde não existe shell Tauri para hospedar o webview filho.
 */
export async function playPrimeInPane(url, title) {
  const invoke = tauriInvoke()
  if (!invoke) return false
  const previous = state.prime.pane
  state.prime.pane = { url, title: title || url }
  state.redraw()
  const rect = hostRect()
  if (!rect) {
    state.prime.pane = previous
    state.redraw()
    throw new Error(
      'painel do prime sem área: recebido placeholder invisível, esperado palco de ao menos 320x180',
    )
  }
  try {
    await invoke('prime_pane_open', { url, ...rect })
  } catch (error) {
    state.prime.pane = previous
    state.redraw()
    throw error
  }
  return true
}

/**
 * Reposiciona o painel nativo sobre o placeholder. Chamar a cada redesenho e resize:
 * o webview filho não participa do layout do DOM, então só a UI sabe onde ele cabe.
 */
export async function syncPrimePane() {
  const invoke = tauriInvoke()
  if (!invoke || !state.prime.pane.url) return
  const rect = hostRect()
  try {
    await (rect ? invoke('prime_pane_place', rect) : invoke('prime_pane_hide', {}))
  } catch {
    // Reposicionar não pode derrubar a UI a cada resize; o erro que o usuário vê vem de
    // playPrimeInPane, que é quem de fato abre o player.
  }
}

/**
 * Esconde o painel e devolve o foco para a UI, sem desfazer a sessão.
 * Necessário ao sair da aba: o webview filho fica por cima de toda a janela.
 */
export async function hidePrimePane() {
  const invoke = tauriInvoke()
  if (!invoke || !state.prime.pane.url) return
  await invoke('prime_pane_hide', {})
}

/** Fecha o painel, para o player oficial e redesenha sem o palco. */
export async function closePrimePane() {
  const invoke = tauriInvoke()
  state.prime.pane = { url: null, title: '' }
  if (invoke) await invoke('prime_pane_close', {})
  state.redraw()
}
