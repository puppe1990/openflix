//! Interpreta as capturas do oráculo do Prime (PRS + licença FairPlay) e monta o
//! descritor que o player nativo precisa: URL do HLS, certificado FairPlay,
//! envelope, handoff e endpoint da licença. A Amazon minta tudo no JS oficial
//! dela; o OpenFlix só reusa os tokens da própria sessão.

const PRS_PATH = /\/Get(?:Vod|Live|LiveLinear)PlaybackResources$/
const LICENSE_PATH = /\/GetFairPlayLicense$/
const LICENSE_HOST = 'atv-ps.primevideo.com'
const PLAYBACK_KEYS = ['vodPlaybackUrls', 'livePlaybackUrls', 'liveLinearPlaybackUrls']

function textOf(value) {
  if (value == null) return ''
  return typeof value === 'string' ? value : JSON.stringify(value)
}

function parseJson(value, label) {
  if (value && typeof value === 'object') return value
  try {
    return JSON.parse(String(value ?? ''))
  } catch {
    throw new Error(
      `captura do prime recusada: recebido ${textOf(value).slice(0, 80)}, esperado ${label} em JSON`,
    )
  }
}

function searchParam(capture, name) {
  try {
    return new URL(String(capture?.url ?? '')).searchParams.get(name) ?? ''
  } catch {
    return ''
  }
}

function capturePath(capture) {
  try {
    return new URL(String(capture?.url ?? '')).pathname
  } catch {
    return ''
  }
}

function captureHost(capture) {
  try {
    return new URL(String(capture?.url ?? '')).hostname
  } catch {
    return ''
  }
}

/** PRS do player oficial: GetVodPlaybackResources / GetLivePlaybackResources. */
export function isPlaybackCapture(capture) {
  return captureHost(capture) === LICENSE_HOST && PRS_PATH.test(capturePath(capture))
}

/** Licença FairPlay do player oficial (o trailer não pede DRM, o filme pede). */
export function isLicenseCapture(capture) {
  return captureHost(capture) === LICENSE_HOST && LICENSE_PATH.test(capturePath(capture))
}

function latestBefore(captures, at, predicate) {
  return captures
    .filter((capture) => predicate(capture))
    .filter((capture) => (capture.at ?? 0) <= at)
    .at(-1)
}

/**
 * Par PRS + licença da última reprodução. O trailer do herói também dispara PRS
 * (sem licença); a licença é o sinal de que o título de verdade começou.
 * @returns {{prs: object, license: object} | null}
 */
export function latestPlaybackPair(captures) {
  const list = Array.isArray(captures) ? captures : []
  const license = list.filter(isLicenseCapture).at(-1)
  if (!license) return null
  const prs = latestBefore(list, license.at ?? 0, isPlaybackCapture)
  return prs ? { prs, license } : null
}

function playbackUrlsOf(response) {
  for (const key of PLAYBACK_KEYS) {
    const result = response?.[key]?.result ?? response?.[key]
    const urls = result?.playbackUrls ?? result
    if (urls?.urlSets?.length) return urls
  }
  const received = Object.keys(response ?? {}).join(', ') || 'vazio'
  throw new Error(
    `PRS do prime sem playbackUrls: recebido ${received}, esperado vodPlaybackUrls ou livePlaybackUrls`,
  )
}

function pickUrlSet(urls) {
  const wanted = String(urls.defaultUrlSetId ?? '')
  return urls.urlSets.find((urlSet) => urlSet.urlSetId === wanted) ?? urls.urlSets[0]
}

function isLiveResponse(response) {
  if (response?.vodPlaybackUrls) return false
  return Boolean(response?.livePlaybackUrls || response?.liveLinearPlaybackUrls)
}

function requireText(value, name) {
  const text = String(value ?? '')
  if (!text) {
    throw new Error(`captura do prime recusada: ${name} recebido vazio, esperado token do PRS`)
  }
  return text
}

function licenseUrlOf(capture) {
  const raw = String(capture?.url ?? '')
  let url
  try {
    url = new URL(raw)
  } catch {
    throw new Error(
      `licença do prime recusada: recebido ${raw || 'vazio'}, esperado URL absoluta do atv-ps`,
    )
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== LICENSE_HOST ||
    !LICENSE_PATH.test(url.pathname)
  ) {
    throw new Error(
      `licença do prime recusada: recebido ${raw}, esperado https://${LICENSE_HOST}/playback/drm-*/GetFairPlayLicense`,
    )
  }
  return raw
}

function hlsUrlOf(urlSet) {
  const raw = String(urlSet?.url ?? '')
  if (!raw.startsWith('https://')) {
    throw new Error(
      `urlSet sem URL do HLS: recebido ${raw || 'vazio'}, esperado https://.../*.m3u8`,
    )
  }
  return raw
}

/**
 * Descritor do player nativo a partir das duas capturas do oráculo.
 * @param {object} prs captura com body (envelope) e response (handoff/cert/URLs)
 * @param {object} license captura da licença FairPlay (fornece o endpoint)
 * @returns {object} playback pronto para o HUD
 */
export function primePlaybackFromCapture(prs, license) {
  const request = parseJson(prs?.body, 'request do PRS')
  const response = parseJson(prs?.response, 'response do PRS')
  const envelope = requireText(request?.globalParameters?.playbackEnvelope, 'playbackEnvelope')
  const handoffToken = requireText(
    response?.sessionization?.sessionHandoffToken,
    'sessionHandoffToken',
  )
  const certBase64 = requireText(
    response?.fairPlayApplicationCertificate?.result?.encodedApplicationCertificate,
    'fairPlayApplicationCertificate',
  )
  const urls = playbackUrlsOf(response)
  const urlSet = pickUrlSet(urls)
  return {
    titleId: searchParam(license, 'titleId') || searchParam(prs, 'titleId') || '',
    prsUrl: String(prs?.url ?? ''),
    prsBody: textOf(prs?.body),
    live: isLiveResponse(response),
    hlsUrl: hlsUrlOf(urlSet),
    keyId: String(urlSet?.fairplayKeyIds?.[0] ?? ''),
    certBase64,
    envelope,
    handoffToken,
    licenseUrl: licenseUrlOf(license),
    durationMs: Number.isFinite(urls?.fullTitleDurationMs) ? urls.fullTitleDurationMs : null,
    defaultAudioTrackId: String(urls?.defaultAudioTrackId ?? ''),
  }
}

/** Atalho: escolhe o último par da lista e monta o descritor. */
export function primePlaybackFromCaptures(captures) {
  const pair = latestPlaybackPair(captures)
  if (!pair) {
    const received = Array.isArray(captures) ? captures.length : 0
    throw new Error(
      `oráculo do prime sem playback: recebido ${received} capturas, esperado PRS + GetFairPlayLicense`,
    )
  }
  return primePlaybackFromCapture(pair.prs, pair.license)
}
