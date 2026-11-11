//! Orquestra o player nativo do Prime: abre o painel oficial só como oráculo,
//! espera o PRS + a licença FairPlay que o JS da Amazon minta, fecha o painel
//! e entrega o HLS para o player/HUD do OpenFlix tocar com FairPlay.

import { fairPlaySupported } from '../src/fairPlay.mjs'
import { primePlaybackFromCapture, primePlaybackFromCaptures } from '../src/primePlayback.mjs'
import { tauriInvoke, tauriListen } from './bridge.mjs'
import { closePrimePane, playPrimeInPane } from './primePane.mjs'
import { primeTrace } from './primeTrace.mjs'
import { transitionTo } from './screenFlow.mjs'
import { state } from './state.mjs'

const ORACLE_TIMEOUT_MS = 45_000
const POLL_STEP_MS = 250
const captures = []
let listening = false

/** Zera as capturas de uma tentativa; o log do Rust continua intacto. */
export function resetPrimeOracle() {
  captures.length = 0
}

async function ensureOracleListener() {
  if (listening) return
  const listen = tauriListen()
  if (!listen) return
  listening = true
  await listen('prime-oracle', (event) => {
    if (event?.payload) captures.push(event.payload)
  })
}

function withSession(playback, response) {
  return primePlaybackFromCapture(
    { url: playback.prsUrl, body: playback.prsBody, response },
    { url: playback.licenseUrl },
  )
}

/**
 * O painel oficial gasta o handoff dele na licença dele; repetir o PRS com o
 * mesmo envelope cunha handoff, certificado e URLs próprios para o nosso CDM.
 */
async function mintPrimeSession(playback) {
  const invoke = tauriInvoke()
  if (!invoke) return playback
  try {
    const response = await invoke('prime_session_mint', {
      url: playback.prsUrl,
      body: playback.prsBody,
    })
    primeTrace('session-minted', { bytes: String(response).length })
    return withSession(playback, response)
  } catch (error) {
    primeTrace('session-fallback', { message: String(error?.message ?? error) })
    return playback
  }
}

function playbackNow() {
  try {
    return primePlaybackFromCaptures(captures)
  } catch {
    return null
  }
}

function sleep(stepMs) {
  return new Promise((resolve) => setTimeout(resolve, stepMs))
}

/** Espera o par PRS + licença do título; o trailer nunca gera licença. */
export async function waitPrimePlayback({ timeoutMs = ORACLE_TIMEOUT_MS } = {}) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const playback = playbackNow()
    if (playback) return playback
    await sleep(POLL_STEP_MS)
  }
  throw new Error(
    `oráculo do prime recusou: recebido sem licença FairPlay em ${timeoutMs}ms, esperado PRS + GetFairPlayLicense`,
  )
}

function canPlayNatively() {
  return fairPlaySupported({
    inTauri: Boolean(tauriInvoke()),
    userAgent: globalThis.navigator?.userAgent,
    requestAccess: globalThis.navigator?.requestMediaKeySystemAccess,
  })
}

function playablePrimeItem(playback, card) {
  return {
    id: playback.titleId || card.titleId || card.title,
    name: card.title || playback.titleId,
    icon: card.coverUrl || '',
    url: playback.hlsUrl,
    prime: playback,
  }
}

function playPrimeNative(playback, card) {
  return transitionTo({
    ...state.shell,
    selectedItem: playablePrimeItem(playback, card),
    screen: 'player',
    catalogKind: 'prime',
  })
}

/**
 * Tenta o player nativo. Devolve false quando o shell não tem FairPlay (Windows/
 * Linux/preview) ou quando o painel nem abriu — aí o chamador usa o fluxo antigo.
 * Se o oráculo falhar depois de abrir, o painel continua tocando como fallback.
 */
export async function tryPrimeNative(url, card) {
  if (!canPlayNatively()) return false
  await ensureOracleListener()
  resetPrimeOracle()
  const opened = await playPrimeInPane(url, card.title)
  if (!opened) return false
  primeTrace('pane-open')
  try {
    const playback = await mintPrimeSession(await waitPrimePlayback())
    primeTrace('capture', { titleId: playback.titleId, live: playback.live })
    await closePrimePane()
    primeTrace('pane-closed')
    await playPrimeNative(playback, card)
    primeTrace('playing')
    return true
  } catch (error) {
    primeTrace(`erro: ${error.message}`)
    state.errorText = `player nativo indisponível (${error.message}); tocando no painel oficial`
    state.redraw()
    return true
  }
}
