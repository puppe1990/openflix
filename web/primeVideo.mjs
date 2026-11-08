import { hydratePrime } from './primeClient.mjs'

/** Nome do evento que leva a interface para a aba Prime Video. */
export const PRIME_SCREEN_EVENT = 'openflix:prime'

/** Troca o destino do catálogo nativo e recarrega as fileiras. */
export function openPrimeDest(key) {
  return hydratePrime(key)
}

/** Troca para a aba Prime Video, que carrega o catálogo pelos endpoints. */
export function openPrimeVideo() {
  const view = document.defaultView ?? globalThis
  document.dispatchEvent(new view.CustomEvent(PRIME_SCREEN_EVENT))
}
