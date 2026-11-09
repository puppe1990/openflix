import { waitYoutubeAuth } from '../src/youtubeAuthPoll.mjs'
import { YOUTUBE_ORIGIN } from '../src/youtubeApi.mjs'
import { tauriInvoke } from './bridge.mjs'

function openInBrowser(url) {
  const open = globalThis.open
  if (typeof open !== 'function') return
  open.call(globalThis, url, '_blank', 'noopener')
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Login oficial do YouTube numa janela do app (a senha nunca passa pelo OpenFlix). */
export async function openYoutubeSignIn({ sleep, maxTries } = {}) {
  const invoke = tauriInvoke()
  if (!invoke) {
    openInBrowser(YOUTUBE_ORIGIN)
    return false
  }
  await invoke('youtube_sign_in')
  await waitYoutubeAuth({
    check: () => invoke('youtube_auth_check'),
    sleep: sleep ?? (() => delay(2000)),
    maxTries: maxTries ?? 90,
  })
  return true
}
