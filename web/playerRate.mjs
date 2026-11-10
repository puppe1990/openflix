import { parsePlaybackRate, rateMenuOptions } from '../src/playerRate.mjs'
import {
  qualityHeadClass,
  qualityItemClass,
  qualityListClass,
  qualityPanelClass,
} from '../src/tvSkin.mjs'
import { el } from './dom.mjs'

function optionRow(option, selected, onPick) {
  const row = el('button', qualityItemClass(selected))
  row.type = 'button'
  row.dataset.rateOption = option.id
  row.setAttribute('role', 'option')
  row.setAttribute('aria-selected', String(selected))
  if (selected) row.append(el('span', 'text-ink', '✓'))
  row.append(el('span', '', option.label))
  row.addEventListener('click', () => onPick(option.value))
  return row
}

function applyTypedRate(input, onPick) {
  try {
    onPick(parsePlaybackRate(input.value))
  } catch {
    input.setAttribute('aria-invalid', 'true')
  }
}

function rateField(onPick) {
  const row = el('div', 'flex items-center gap-2 px-4 py-3')
  const input = el(
    'input',
    'min-w-0 flex-1 rounded-md border-0 bg-black/40 px-3 py-2 font-sans text-[16px] font-bold text-white ring-1 ring-white/20',
  )
  input.type = 'text'
  input.inputMode = 'decimal'
  input.placeholder = '1.5'
  input.dataset.rateInput = '1'
  input.setAttribute('aria-label', 'Velocidade')
  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    applyTypedRate(input, onPick)
  })
  const apply = el(
    'button',
    'shrink-0 cursor-pointer rounded-md border-0 bg-white/10 px-3 py-2 font-sans text-[14px] font-bold text-white',
    'Aplicar',
  )
  apply.type = 'button'
  apply.dataset.rateApply = '1'
  apply.addEventListener('click', () => applyTypedRate(input, onPick))
  row.append(input, apply)
  queueMicrotask(() => input.focus())
  return row
}

function ratePanel({ selected, onPick, onClose }) {
  const panel = el('div', qualityPanelClass())
  panel.dataset.ratePanel = '1'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Velocidade')
  const head = el('button', qualityHeadClass(), '< Velocidade')
  head.type = 'button'
  head.dataset.rateBack = '1'
  head.addEventListener('click', onClose)
  const list = el('div', qualityListClass())
  for (const option of rateMenuOptions()) {
    list.append(optionRow(option, Math.abs(option.value - selected) < 0.001, onPick))
  }
  panel.append(head, list, rateField(onPick))
  return panel
}

/** Liga a caixa de velocidade no quadro do player. */
export function syncPlayerRate(frame, model) {
  if (!frame) return
  const button = frame.querySelector('[data-player-rate]')
  frame.querySelector('[data-rate-panel]')?.remove()
  if (!button) return
  button.setAttribute('aria-expanded', String(Boolean(model.open)))
  button.setAttribute('aria-haspopup', 'dialog')
  if (!model.open) return
  frame.append(ratePanel(model))
}

/** Pinta a caixa a partir do held do player. */
export function paintPlayerRate(held, onPaint) {
  syncPlayerRate(held.frame, {
    open: held.rateOpen,
    selected: held.video?.playbackRate || 1,
    onPick(rate) {
      if (!held.video) return
      held.video.playbackRate = rate
      held.rateOpen = false
      onPaint?.()
    },
    onClose() {
      held.rateOpen = false
      onPaint?.()
    },
  })
}

/** Abre/fecha a caixa; fecha Qualidade. */
export function togglePlayerRate(held, paint) {
  held.qualityOpen = false
  held.rateOpen = !held.rateOpen
  paint()
}

/** Fecha a caixa de velocidade; true se consumiu o Escape. */
export function closePlayerRate(held, paint) {
  if (!held.rateOpen) return false
  held.rateOpen = false
  paint()
  return true
}
