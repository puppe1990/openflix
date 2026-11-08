import { YOUTUBE_ORIGIN } from '../src/youtubeApi.mjs'
import { tauriInvoke } from './bridge.mjs'

function openInBrowser(url) {
  const open = globalThis.open
  if (typeof open !== 'function') return
  open.call(globalThis, url, '_blank', 'noopener')
}

/** Login oficial do YouTube numa janela do app (a senha nunca passa pelo OpenFlix). */
export async function openYoutubeSignIn() {
  const invoke = tauriInvoke()
  if (!invoke) {
    openInBrowser(YOUTUBE_ORIGIN)
    return false
  }
  await invoke('youtube_sign_in')
  return true
}
