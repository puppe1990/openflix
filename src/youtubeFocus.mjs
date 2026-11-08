import { createPrimeFocus, movePrimeFocus } from './primeFocus.mjs'

/** Foco 10-foot da tela YouTube: mesmo trilho/fileiras do Prime. */
export function createYoutubeFocus() {
  return createPrimeFocus()
}

/** Move o foco; detalhe aberto ignora setas. */
export function moveYoutubeFocus(focus, key, opts) {
  return movePrimeFocus(focus, key, opts)
}

/** Enter no card toca; no trilho abre o destino. */
export function youtubeFocusAction(focus, key, { hasDetail = false }) {
  if (hasDetail && (key === 'Escape' || key === 'Backspace')) return 'close-detail'
  if (hasDetail && key === 'Enter') return 'play-detail'
  if (key !== 'Enter') return null
  if (focus.zone === 'rail') return 'open-dest'
  if (focus.zone === 'rows') return 'play-card'
  return null
}
