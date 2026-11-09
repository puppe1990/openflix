import { HLS_QUALITY_AUTO, loadHlsQualities, withAutoQuality } from '../src/hlsQualities.mjs'
import {
  ghostClass,
  qualityHeadClass,
  qualityItemClass,
  qualityListClass,
  qualityPanelClass,
} from '../src/tvSkin.mjs'
import { el } from './dom.mjs'

export { HLS_QUALITY_AUTO }

/** Estado do menu Qualidade preso no player. */
export function emptyQualityState() {
  return {
    masterUrl: '',
    qualities: [],
    qualityId: HLS_QUALITY_AUTO,
    qualityOpen: false,
    qualityToken: 0,
  }
}

/** Invalida um hydrate em voo e esconde o menu. */
export function resetQualityState(held) {
  held.qualityToken += 1
  held.masterUrl = ''
  held.qualities = []
  held.qualityId = HLS_QUALITY_AUTO
  held.qualityOpen = false
}

/** Níveis primeiro, Automático no rodapé — como o menu do YouTube. */
export function qualityMenuOptions(qualities, masterUrl) {
  if (!masterUrl) return []
  const rows = withAutoQuality(qualities ?? [], masterUrl)
  return [...rows.slice(1), rows[0]]
}

function qualityButton() {
  const button = el('button', ghostClass(), 'Qualidade')
  button.type = 'button'
  button.dataset.quality = '1'
  button.setAttribute('aria-haspopup', 'listbox')
  return button
}

function optionRow(option, selected, onPick) {
  const row = el('button', qualityItemClass(selected))
  row.type = 'button'
  row.dataset.qualityOption = option.id
  row.setAttribute('role', 'option')
  row.setAttribute('aria-selected', String(selected))
  if (selected) row.append(el('span', 'text-ink', '✓'))
  row.append(el('span', '', option.label))
  row.addEventListener('click', () => onPick(option.id))
  return row
}

function qualityPanel({ options, selectedId, onPick, onClose }) {
  const panel = el('div', qualityPanelClass())
  panel.dataset.qualityPanel = '1'
  panel.setAttribute('role', 'listbox')
  panel.setAttribute('aria-label', 'Qualidade')
  const head = el('button', qualityHeadClass(), '< Qualidade')
  head.type = 'button'
  head.dataset.qualityBack = '1'
  head.addEventListener('click', onClose)
  const list = el('div', qualityListClass())
  for (const option of options) {
    list.append(optionRow(option, option.id === selectedId, onPick))
  }
  panel.append(head, list)
  return panel
}

function placeQualityButton(toolbar, onToggle) {
  const button = qualityButton()
  button.addEventListener('click', onToggle)
  const anchor = toolbar.querySelector('[data-sidecar]')
  if (anchor) toolbar.insertBefore(button, anchor)
  else toolbar.append(button)
  return button
}

/** Liga botão e overlay Qualidade no quadro do player. */
export function syncPlayerQuality(frame, model) {
  if (!frame) return
  const toolbar = frame.querySelector('[data-player-toolbar]')
  if (!toolbar) return
  const show = (model.qualities?.length ?? 0) >= 2 && Boolean(model.masterUrl)
  let button = toolbar.querySelector('[data-quality]')
  if (!show) {
    button?.remove()
    frame.querySelector('[data-quality-panel]')?.remove()
    return
  }
  if (!button) button = placeQualityButton(toolbar, model.onToggle)
  button.setAttribute('aria-expanded', String(Boolean(model.open)))
  frame.querySelector('[data-quality-panel]')?.remove()
  if (!model.open) return
  frame.append(
    qualityPanel({
      options: qualityMenuOptions(model.qualities, model.masterUrl),
      selectedId: model.selectedId,
      onPick: model.onPick,
      onClose: model.onClose,
    }),
  )
}

/** Baixa o master HLS e grava os STREAM-INF no held. */
export async function hydratePlayerQualities(held, url, fetchFn) {
  const token = ++held.qualityToken
  try {
    const found = await loadHlsQualities(url, fetchFn)
    if (token !== held.qualityToken) return false
    held.masterUrl = url
    held.qualities = found
    held.qualityId = HLS_QUALITY_AUTO
    return found.length >= 2
  } catch {
    if (token !== held.qualityToken) return false
    held.qualities = []
    held.masterUrl = ''
    return false
  }
}

/** URL do master ou do variant escolhido. */
export function qualityPlaybackUrl(held, id) {
  if (!held.masterUrl) return null
  return withAutoQuality(held.qualities, held.masterUrl).find((row) => row.id === id) ?? null
}
