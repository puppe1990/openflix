/** Só a sessão YouTube/Google vai pro Innertube. __Host-* deixa a chamada anônima. */
export const YOUTUBE_AUTH_COOKIE_NAMES = [
  'SID',
  'HSID',
  'SSID',
  'APISID',
  'SAPISID',
  '__Secure-1PSID',
  '__Secure-3PSID',
  '__Secure-1PAPISID',
  '__Secure-3PAPISID',
  '__Secure-1PSIDTS',
  '__Secure-3PSIDTS',
  'SIDCC',
  '__Secure-1PSIDCC',
  '__Secure-3PSIDCC',
  'VISITOR_INFO1_LIVE',
  'VISITOR_PRIVACY_METADATA',
  'PREF',
  'YSC',
  '__Secure-YEC',
  'LOGIN_INFO',
]

/** Normaliza o header Cookie colado (tira prefixo e espaços). */
export function normalizeYoutubeCookie(raw) {
  const stripped = String(raw ?? '')
    .trim()
    .replace(/^cookie:\s*/i, '')
  if (!stripped) {
    throw new Error('cookie recusado: recebido vazio, esperado pares name=value')
  }
  if (!stripped.includes('=')) {
    throw new Error(`cookie recusado: recebido ${stripped.slice(0, 40)}, esperado pares name=value`)
  }
  return stripped
}

function cookiePairs(header) {
  return header.split(';').map((part) => {
    const [name, ...rest] = part.trim().split('=')
    return [name.trim(), rest.join('=').trim()]
  })
}

/** Fica só com os nomes da sessão YouTube, na ordem da allowlist. */
export function filterYoutubeCookie(raw) {
  const header = normalizeYoutubeCookie(raw)
  const pairs = cookiePairs(header)
  const picked = []
  for (const name of YOUTUBE_AUTH_COOKIE_NAMES) {
    const match = pairs.find(([cookieName]) => cookieName === name)
    if (match?.[1]) picked.push(`${name}=${match[1]}`)
  }
  return picked.join('; ')
}

/** Login real: LOGIN_INFO ou SAPISID. SID/VISITOR sozinhos deixam o Innertube anônimo. */
export function youtubeSessionReady(raw) {
  if (!raw || !String(raw).includes('=')) return false
  try {
    return cookiePairs(filterYoutubeCookie(raw)).some(
      ([name, value]) => (name === 'LOGIN_INFO' || name === 'SAPISID') && Boolean(value),
    )
  } catch {
    return false
  }
}
