import { byId } from './dom.mjs'
import { state } from './state.mjs'

/** Liga ou desliga o overlay de troca de tela. */
export function renderSpinner() {
  const root = byId('screen-spinner')
  if (!root) return
  const busy = Boolean(state.spinner?.busy)
  root.hidden = !busy
  root.setAttribute('aria-busy', String(busy))
  const label = byId('screen-spinner-label')
  if (label) label.textContent = busy ? (state.spinner.label ?? '') : ''
}
