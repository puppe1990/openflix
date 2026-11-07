export const PRIME_ORIGIN = 'https://www.primevideo.com'

const PRIME_HOSTS = ['primevideo.com', 'www.primevideo.com']
const GTI_PREFIX = 'amzn1.dv.gti.'
const GTI_ID = /^amzn1\.dv\.gti\.[A-Za-z0-9-]+$/

/** Aceita só https em primevideo.com (recusa lookalike e http). */
export function isPrimeVideoUrl(raw) {
  let url
  try {
    url = new URL(String(raw))
  } catch {
    return false
  }
  return url.protocol === 'https:' && PRIME_HOSTS.includes(url.hostname)
}

/** URL oficial do player para o card: href da loja ou detalhe pelo titleId. */
export function primePlayUrl(card) {
  const href = String(card?.href ?? '')
  if (isPrimeVideoUrl(href)) return href
  const titleId = String(card?.titleId ?? '')
  if (GTI_ID.test(titleId)) return `${PRIME_ORIGIN}/detail/${titleId}`
  const received = href || titleId || 'vazio'
  throw new Error(
    `card sem player: recebido ${received}, esperado href ${PRIME_ORIGIN}/... ou titleId ${GTI_PREFIX}*`,
  )
}
