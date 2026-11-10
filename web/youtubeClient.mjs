import {
  YOUTUBE_BROWSE,
  YOUTUBE_PLAYER,
  YOUTUBE_SEARCH,
  assertYoutubeRequest,
  youtubePlayerBodies,
  youtubeWebBody,
} from '../src/youtubeApi.mjs'
import { parseYoutubeBrowse } from '../src/youtubeBrowse.mjs'
import { pickPreferredYoutubePlayback } from '../src/youtubePlayer.mjs'
import { YOUTUBE_CHROME_DESTS, youtubeDest } from '../src/youtubeNav.mjs'
import { parseYoutubeSearch } from '../src/youtubeSearch.mjs'
import { tauriInvoke } from './bridge.mjs'
import { state } from './state.mjs'

function requireShell() {
  const invoke = tauriInvoke()
  if (!invoke) {
    throw new Error('youtube recusou: recebido preview web, esperado app Tauri')
  }
  return invoke
}

/** Prefixa uma vez; erros do domínio já vêm com `youtube recusou:`. */
export function formatYoutubeError(error) {
  const message = error?.message ?? String(error)
  return message.startsWith('youtube recusou:') ? message : `youtube recusou: ${message}`
}

/** POST Innertube via comando Tauri (sem CORS no preview). */
export async function youtubeRequest(path, body) {
  assertYoutubeRequest('POST', path)
  const text = await requireShell()('youtube_request', {
    path,
    body: JSON.stringify(body ?? {}),
  })
  return JSON.parse(text)
}

/** Base do proxy local `http://127.0.0.1:{port}`. */
export async function loadYoutubeProxyBase() {
  return requireShell()('youtube_proxy_base')
}

/** ANDROID `/player`; se só vier itag 18, tenta IOS/WEB atrás do HLS (menu Qualidade). */
export async function loadYoutubePlayback(videoId) {
  const payloads = []
  let lastError
  for (const body of youtubePlayerBodies({ videoId })) {
    try {
      payloads.push(await youtubeRequest(YOUTUBE_PLAYER, body))
    } catch (error) {
      lastError = error
      continue
    }
    try {
      const picked = pickPreferredYoutubePlayback(payloads)
      if (picked.kind === 'hls') return picked
      const clientName = body.context.client.clientName
      if (clientName === 'IOS' || clientName === 'WEB') return picked
    } catch (error) {
      lastError = error
    }
  }
  try {
    return pickPreferredYoutubePlayback(payloads)
  } catch (error) {
    throw lastError ?? error
  }
}

async function fillBrowse(dest) {
  try {
    const payload = await youtubeRequest(YOUTUBE_BROWSE, youtubeWebBody({ browseId: dest.key }))
    state.youtube.rows = parseYoutubeBrowse(payload)
    state.errorText = ''
  } catch (error) {
    state.errorText = formatYoutubeError(error)
    state.youtube.rows = []
  }
}

/** Recarrega o Início quando o webview oficial grava a sessão. */
export async function onYoutubeSessionCaptured() {
  if (state.shell.screen !== 'youtube') return
  await hydrateYouTube(state.youtube.destKey)
}

/** Liga o evento `youtube-session` do shell. Devolve false sem listen. */
export function wireYoutubeSessionListener(listen) {
  if (typeof listen !== 'function') return false
  void listen('youtube-session', () => onYoutubeSessionCaptured())
  return true
}

/** Carrega trilho chrome + browse do destino e redesenha. */
export async function hydrateYouTube(destKey) {
  state.youtube.dests = [...YOUTUBE_CHROME_DESTS]
  let dest = state.youtube.dests[0]
  try {
    dest = destKey
      ? youtubeDest(state.youtube.dests, destKey)
      : (state.youtube.dests.find((item) => item.key === state.youtube.destKey) ?? dest)
  } catch (error) {
    state.errorText = formatYoutubeError(error)
  }
  state.youtube.destKey = dest.key
  state.youtube.detail = null
  await fillBrowse(dest)
  state.redraw()
}

let searchToken = 0

/** Busca Innertube; query vazia volta ao destino atual. */
export async function searchYouTube(query) {
  const trimmed = String(query ?? '').trim()
  const mine = ++searchToken
  if (!trimmed) {
    await hydrateYouTube(state.youtube.destKey)
    return
  }
  try {
    const payload = await youtubeRequest(YOUTUBE_SEARCH, youtubeWebBody({ query: trimmed }))
    if (mine !== searchToken) return
    state.youtube.rows = parseYoutubeSearch(payload, trimmed)
    state.youtube.detail = null
    state.errorText = ''
  } catch (error) {
    if (mine !== searchToken) return
    state.errorText = formatYoutubeError(error)
    state.youtube.rows = []
  }
  state.redraw()
}

let searchTimer = 0

/** Debounce da busca no header. */
export function queueYoutubeSearch(query) {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => void searchYouTube(query), 280)
}
