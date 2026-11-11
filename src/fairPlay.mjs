//! FairPlay (`com.apple.fps`) no WKWebView para o HLS nativo do Prime.
//! Neste build o <video> só decodifica pelo caminho legado (`WebKitMediaKeys` +
//! `webkitSetMediaKeys`); o EME padrão fica como fallback. O certificado vem do
//! PRS e o desafio (SPC) vai para o endpoint oficial da Amazon via comando Rust;
//! a chave (CKC) volta para o CDM do sistema. O OpenFlix não gera envelope nem
//! chave: só usa o que a própria sessão mintou.

const DEFAULT_KEY_SYSTEM = 'com.apple.fps'
const CONFIGS = [
  {
    initDataTypes: ['skd'],
    videoCapabilities: [{ contentType: 'application/vnd.apple.mpegurl', robustness: '' }],
    distinctiveIdentifier: 'not-allowed',
    persistentState: 'not-allowed',
    sessionTypes: ['temporary'],
  },
  {
    initDataTypes: ['skd'],
    videoCapabilities: [{ contentType: 'video/mp4', robustness: '' }],
    distinctiveIdentifier: 'not-allowed',
    persistentState: 'not-allowed',
    sessionTypes: ['temporary'],
  },
]

/** Decodifica base64 padrão (certificado DER) em bytes. */
export function base64ToBytes(text) {
  const binary = atob(String(text ?? ''))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

/** Codifica bytes em base64 padrão (desafio SPC e resposta CKC). */
export function bytesToBase64(bytes) {
  let binary = ''
  const chunk = new Uint8Array(bytes ?? [])
  for (let index = 0; index < chunk.length; index += 1) {
    binary += String.fromCharCode(chunk[index])
  }
  return btoa(binary)
}

/** Extrai `skd://...` do initData FairPlay; vazio quando não é skd. */
export function skdKeyId(initData) {
  const text = new TextDecoder().decode(initData ?? new Uint8Array())
  return text.startsWith('skd://') ? text : ''
}

/**
 * FairPlay só existe no WKWebView do macOS. Windows/Linux (WebView2/WebKitGTK)
 * não têm `com.apple.fps` e caem no painel oficial da Amazon.
 */
export function fairPlaySupported({ inTauri = false, userAgent = '', requestAccess = null } = {}) {
  return Boolean(
    inTauri && /Macintosh/.test(String(userAgent)) && typeof requestAccess === 'function',
  )
}

/**
 * O `webkitneedkey` do WKWebView entrega o initData como uint32LE + UTF-16LE
 * (`skd://...`); o `generateRequest('skd')` espera o URI em UTF-8. Sem
 * normalizar, o SPC sai com content ID que a Amazon recusa como Invalid.
 */
export function skdInitData(initData) {
  const raw = new Uint8Array(initData ?? [])
  const prefixed = raw.length > 8 && raw[1] === 0 && raw[3] === 0 && raw[0] === raw.length - 4
  if (!prefixed) return raw
  const text = new TextDecoder('utf-16le').decode(raw.slice(4))
  if (!text.startsWith('skd://')) return raw
  return new TextEncoder().encode(text)
}

/** Codifica texto em UTF-16LE (formato dos initData legados do WebKit). */
export function utf16leBytes(text) {
  const out = new Uint8Array(text.length * 2)
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    out[index * 2] = code & 0xff
    out[index * 2 + 1] = code >> 8
  }
  return out
}

/**
 * initData do FairPlay legado do WebKit: `[len][key][len][key][len][cert]`,
 * com o key URI em UTF-16LE e o certificado DER da Amazon. É o payload que o
 * player oficial entrega ao `createSession` — só o `skd://` do evento é
 * recusado pelo CDM com `webkitkeyerror`.
 */
export function legacyInitData(keyId, certBytes) {
  const uri = utf16leBytes(String(keyId ?? ''))
  const chunks = [uri, uri, new Uint8Array(certBytes ?? [])]
  const total = chunks.reduce((sum, chunk) => sum + 4 + chunk.length, 0)
  const out = new Uint8Array(total)
  const view = new DataView(out.buffer)
  let offset = 0
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.length, true)
    out.set(chunk, offset + 4)
    offset += 4 + chunk.length
  }
  return out
}

/**
 * Liga a faixa de áudio preferida na lista nativa do HLS (`video.audioTracks`).
 * A Amazon manda `en-gb_dialog_0` como default no PRS; o HUD do OpenFlix é
 * pt-BR, então o português ganha quando o manifest oferece.
 * @returns {string} idioma ligado, ou vazio quando o webview não expõe a lista
 */
export function pickAudioTrack(video, preferred = 'pt') {
  const tracks = video?.audioTracks
  if (!tracks || typeof tracks.length !== 'number' || tracks.length === 0) return ''
  const rows = Array.from(tracks)
  const chosen = rows.find((track) =>
    String(track?.language ?? '')
      .toLowerCase()
      .startsWith(preferred),
  )
  if (!chosen) return ''
  for (const track of rows) track.enabled = track === chosen
  return String(chosen.language ?? '')
}

async function openAccess(requestAccess, keySystem) {
  let lastError = null
  for (const config of CONFIGS) {
    try {
      return await requestAccess(keySystem, [config])
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('fairplay recusado: recebido configuração vazia')
}

function awaitMessage(session) {
  return new Promise((resolve) =>
    session.addEventListener('message', (event) => resolve(event.message)),
  )
}

/** Assinatura hex do initData: dedupe do mesmo keyId repetido pelo player. */
function hexOf(initData) {
  return Array.from(new Uint8Array(initData ?? []), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/**
 * Key systems que o `WebKitMediaKeys` legado aceita no macOS. O moderno é
 * `com.apple.fps`; builds antigos só respondem ao prefixo de versão 1_0.
 */
const LEGACY_KEY_SYSTEMS = ['com.apple.fps', 'com.apple.fps.1_0']
/// O `webkitkeymessage` sai rápido quando o CDM aceita; 4 s cobrem o painel.
const LEGACY_MESSAGE_TIMEOUT_MS = 4000

function createLegacyKeys(keySystem) {
  const candidates = [keySystem, ...LEGACY_KEY_SYSTEMS.filter((item) => item !== keySystem)]
  let lastError = null
  for (const candidate of candidates) {
    try {
      return new globalThis.WebKitMediaKeys(candidate)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('fairplay recusado: recebido WebKitMediaKeys sem key system')
}

function legacyMessage(session) {
  return new Promise((resolve, reject) => {
    // No caminho legado os eventos são handlers de propriedade; `addEventListener`
    // existe (EventTarget), mas o WebKit não despacha `webkitkeymessage` por ele.
    session.onwebkitkeymessage = (event) => resolve(event.message)
    session.onwebkitkeyerror = () =>
      reject(
        new Error(
          `fairplay recusado: recebido ${session.error?.message ?? 'webkitkeyerror'} do CDM`,
        ),
      )
  })
}

/** O CDM legado às vezes engole o pedido; sem limite o player fica no escuro. */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`fairplay recusado: recebido sem webkitkeymessage em ${ms}ms`)),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * FairPlay pelo caminho legado do WKWebView (`WebKitMediaKeys` + `video.webkitKeys`).
 * É o mesmo que o player oficial da Amazon usa nesta engine: o `<video>` só
 * decodifica quando a sessão de chaves vem desse construtor — um `MediaKeys`
 * de EME padrão é aceito por `setMediaKeys` mas ignorado pelo decodificador.
 */
async function attachLegacyFairPlay(video, { certBase64, license, keySystem, onError, onEvent }) {
  const keys = createLegacyKeys(keySystem)
  onEvent?.('legacy-keys', {
    keySystem: keys.keySystem ?? keySystem,
    methods: Object.getOwnPropertyNames(Object.getPrototypeOf(keys) ?? {}),
  })
  if (typeof keys.setServerCertificate === 'function') {
    await keys.setServerCertificate(base64ToBytes(certBase64))
    onEvent?.('legacy-certificate')
  }
  // `webkitKeys` é readonly neste build; o setter legado é `webkitSetMediaKeys`.
  if (typeof video.webkitSetMediaKeys === 'function') {
    await video.webkitSetMediaKeys(keys)
  } else {
    video.webkitKeys = keys
  }
  onEvent?.('legacy-attached', {
    webkitKeys: Boolean(video.webkitKeys),
    setter: typeof video.webkitSetMediaKeys,
  })
  const sessions = new Set()
  const handledKeys = new Set()
  const certBytes = base64ToBytes(certBase64)

  async function licenseSession(initData) {
    const session = keys.createSession('video/mp4', initData)
    sessions.add(session)
    const message = legacyMessage(session)
    const challenge = bytesToBase64(await withTimeout(message, LEGACY_MESSAGE_TIMEOUT_MS))
    onEvent?.('legacy-challenge', { length: challenge.length })
    const licenseBase64 = await license(challenge)
    onEvent?.('legacy-license', { length: String(licenseBase64 ?? '').length })
    session.update(base64ToBytes(licenseBase64))
    onEvent?.('legacy-updated')
  }

  async function handleInitData(initData) {
    const signature = hexOf(initData)
    if (handledKeys.has(signature)) return
    handledKeys.add(signature)
    try {
      await licenseSession(initData)
    } catch (error) {
      handledKeys.delete(signature)
      onEvent?.('legacy-failed', { message: String(error?.message ?? error) })
      onError?.(error)
    }
  }

  function onNeedKey(event) {
    const keyUri = skdKeyId(skdInitData(event?.initData))
    onEvent?.('legacy-needkey', { bytes: event?.initData?.byteLength ?? 0, keyId: keyUri })
    if (!keyUri) return
    void handleInitData(legacyInitData(keyUri, certBytes))
  }

  video.addEventListener('webkitneedkey', onNeedKey)
  return function detach() {
    video.removeEventListener('webkitneedkey', onNeedKey)
    try {
      if (typeof video.webkitSetMediaKeys === 'function') video.webkitSetMediaKeys(null)
      else video.webkitKeys = null
    } catch {
      // Propriedade já liberada pelo elemento: nada a soltar.
    }
    for (const session of sessions) {
      try {
        session.close?.()
      } catch {
        // Sessão já fechada pelo CDM: não há o que limpar.
      }
    }
    sessions.clear()
  }
}

/**
 * Prepara o `<video>` para HLS FairPlay: instala o certificado do PRS e, a cada
 * `encrypted`, envia o SPC para a licença e aplica o CKC no CDM.
 * @returns {Promise<() => void>} função de limpeza
 */
export async function attachFairPlay(
  video,
  {
    certBase64,
    license,
    keySystem = DEFAULT_KEY_SYSTEM,
    requestAccess = globalThis.navigator?.requestMediaKeySystemAccess?.bind(globalThis.navigator),
    onError,
    onEvent,
  } = {},
) {
  if (typeof requestAccess !== 'function') {
    throw new Error('fairplay recusado: recebido EME ausente, esperado WKWebView com com.apple.fps')
  }
  if (typeof license !== 'function') {
    throw new Error(
      `fairplay recusado: recebido licença ${typeof license}, esperado função do shell`,
    )
  }
  if (typeof globalThis.WebKitMediaKeys === 'function' && 'webkitKeys' in video) {
    return attachLegacyFairPlay(video, { certBase64, license, keySystem, onError, onEvent })
  }
  const access = await openAccess(requestAccess, keySystem)
  const mediaKeys = await access.createMediaKeys()
  await mediaKeys.setServerCertificate(base64ToBytes(certBase64))
  await video.setMediaKeys(mediaKeys)
  onEvent?.('keys-ready', { keySystem })
  const sessions = new Set()
  const handledKeys = new Set()
  let closed = false

  function keySignature(initData) {
    return Array.from(new Uint8Array(initData ?? []), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')
  }

  async function requestLicense(initData) {
    const session = mediaKeys.createSession()
    sessions.add(session)
    const message = awaitMessage(session)
    await session.generateRequest('skd', skdInitData(initData))
    const challenge = bytesToBase64(await message)
    onEvent?.('challenge', { length: challenge.length })
    const licenseBase64 = await license(challenge)
    onEvent?.('license', { length: String(licenseBase64 ?? '').length })
    const keyBytes = base64ToBytes(licenseBase64)
    if (!closed) await session.update(keyBytes)
    onEvent?.('updated')
  }

  async function handleKey(initData) {
    const signature = keySignature(initData)
    if (handledKeys.has(signature)) return
    handledKeys.add(signature)
    try {
      onEvent?.('encrypted', { keyId: skdKeyId(initData) })
      await requestLicense(initData)
    } catch (error) {
      handledKeys.delete(signature)
      onEvent?.('failed', { message: String(error?.message ?? error) })
      onError?.(error)
    }
  }

  // WKWebView entrega FairPlay pelo evento legado `webkitneedkey`; Safari com
  // MSE entrega `encrypted`. Os dois caem no mesmo pedido de licença, com
  // dedupe porque o webkitneedkey repete a cada tentativa do player.
  function onEncrypted(event) {
    if (event?.initDataType && event.initDataType !== 'skd') return
    void handleKey(event.initData)
  }

  function onNeedKey(event) {
    if (!event?.initData) return
    void handleKey(event.initData)
  }

  video.addEventListener('encrypted', onEncrypted)
  video.addEventListener('webkitneedkey', onNeedKey)
  return function detach() {
    closed = true
    video.removeEventListener('encrypted', onEncrypted)
    video.removeEventListener('webkitneedkey', onNeedKey)
    for (const session of sessions) {
      try {
        session.close?.()
      } catch {
        // Sessão já fechada pelo CDM: não há o que limpar.
      }
    }
    sessions.clear()
  }
}
