import {
  assertPrimeRequest,
  PRIME_ENRICH_NAV,
  PRIME_LANDING,
  PRIME_ORIGIN,
} from '../src/primeApi.mjs'
import { parseLanding } from '../src/primeLanding.mjs'
import { primeLandingForm } from '../src/primeLandingForm.mjs'
import { parseEnrichNav, PRIME_HOME_DEST, primeDest } from '../src/primeNav.mjs'
import { tauriFetch, tauriInvoke } from './bridge.mjs'
import { state } from './state.mjs'

const PRIME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36'

function enrichNavUrl() {
  return `${PRIME_ORIGIN}${PRIME_ENRICH_NAV}?enrichmentType=GET_CATEGORIES`
}

async function viaShell(method, path, body) {
  const text = await tauriInvoke()('prime_request', { method, path, body: body ?? null })
  return JSON.parse(text)
}

async function viaFetch(method, path, body) {
  const url = path === PRIME_ENRICH_NAV ? enrichNavUrl() : `${PRIME_ORIGIN}${path}`
  const fetchFn = tauriFetch() ?? globalThis.fetch.bind(globalThis)
  const headers = {
    Accept: '*/*',
    'Accept-Language': 'pt-BR,pt;q=0.9',
    'User-Agent': PRIME_UA,
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (body) headers['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8'
  const res = await fetchFn(url, { method, headers, body: body || undefined })
  if (!res.ok) {
    throw new Error(`prime recusou: recebido HTTP ${res.status}, esperado 2xx`)
  }
  return res.json()
}

async function primeRequest(method, path, body) {
  assertPrimeRequest(method, path)
  if (tauriInvoke()) return viaShell(method, path, body)
  return viaFetch(method, path, body)
}

/** GET /api/enrichNav → trilho de destinos. */
export async function loadPrimeNav() {
  return parseEnrichNav(await primeRequest('GET', PRIME_ENRICH_NAV))
}

/** POST /api/getLandingPage → fileiras da página. */
export async function loadPrimeLanding(dest, page = {}) {
  const form = primeLandingForm(dest, page)
  return parseLanding(await primeRequest('POST', PRIME_LANDING, form.toString()))
}

async function fillNav() {
  try {
    state.prime.dests = await loadPrimeNav()
  } catch (error) {
    state.errorText = `prime video recusou: ${error.message}`
    if (!state.prime.dests.length) state.prime.dests = [PRIME_HOME_DEST]
  }
}

async function fillLanding(dest) {
  try {
    const page = await loadPrimeLanding(dest)
    if (page.hasFailed) {
      throw new Error('landing recusado: recebido hasFailed, esperado containers')
    }
    state.prime.rows = page.rows
  } catch (error) {
    state.errorText = `prime video recusou: ${error.message}`
    state.prime.rows = []
  }
}

/** Carrega nav + landing do destino e redesenha. */
export async function hydratePrime(destKey) {
  await fillNav()
  let dest = state.prime.dests[0]
  try {
    dest = destKey
      ? primeDest(state.prime.dests, destKey)
      : (state.prime.dests.find((item) => item.key === state.prime.destKey) ?? state.prime.dests[0])
  } catch (error) {
    state.errorText = `prime video recusou: ${error.message}`
  }
  state.prime.destKey = dest.key
  state.prime.detail = null
  await fillLanding(dest)
  state.redraw()
}
