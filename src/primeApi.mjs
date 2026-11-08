export const PRIME_ORIGIN = 'https://www.primevideo.com'
export const PRIME_ENRICH_NAV = '/api/enrichNav'
export const PRIME_LANDING = '/api/getLandingPage'

const ALLOWED = [
  ['GET', PRIME_ENRICH_NAV],
  ['POST', PRIME_LANDING],
]

/** Recusa qualquer chamada fora do BFF de loja (nav + landing). */
export function assertPrimeRequest(method, path) {
  if (
    ALLOWED.some(([allowedMethod, allowedPath]) => allowedMethod === method && allowedPath === path)
  ) {
    return
  }
  throw new Error(
    `endpoint do prime recusado: recebido ${method} ${path}, esperado GET ${PRIME_ENRICH_NAV} ou POST ${PRIME_LANDING}`,
  )
}

/** Junta origem oficial com caminho relativo do card. */
export function absolutePrimeUrl(path) {
  if (!path) return ''
  if (path.startsWith('https://') || path.startsWith('http://')) return path
  const slash = path.startsWith('/') ? path : `/${path}`
  return `${PRIME_ORIGIN}${slash}`
}
