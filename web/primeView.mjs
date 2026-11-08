import { movePrimeFocus, primeFocusAction } from '../src/primeFocus.mjs'
import { primePlayUrl } from '../src/primePlay.mjs'
import { primeChipClass } from '../src/tvSkin.mjs'
import { byId, el } from './dom.mjs'
import {
  closePrimePane,
  hidePrimePane,
  PANE_HOST_ID,
  playPrimeInPane,
  syncPrimePane,
} from './primePane.mjs'
import { openPrimeDest } from './primeVideo.mjs'
import { openPrimeBrowser, openPrimePlayer, openPrimeSignIn } from './primeWindow.mjs'
import { state } from './state.mjs'

function panePlaying() {
  return Boolean(state.prime.pane?.url)
}

/** Executa uma janela oficial e publica o erro quando o card não tem destino. */
async function runPrimeWindow(action) {
  try {
    await action()
    state.errorText = ''
  } catch (error) {
    state.errorText = `prime video recusou: ${error.message}`
  }
  state.redraw()
}

async function playPrimeCard(card) {
  state.prime.detail = null
  const url = primePlayUrl(card)
  try {
    const opened = await playPrimeInPane(url, card.title)
    if (!opened) await openPrimePlayer(url)
    state.errorText = ''
  } catch (error) {
    state.errorText = `prime video recusou: ${error.message}`
  }
  state.redraw()
}

function browsePrimeCard(card) {
  return runPrimeWindow(() => openPrimeBrowser(primePlayUrl(card)))
}

function openPrimeStore() {
  return runPrimeWindow(openPrimeSignIn)
}

function groupedDests(dests) {
  const groups = []
  for (const dest of dests) {
    const last = groups[groups.length - 1]
    if (last && last.label === dest.group) last.items.push(dest)
    else groups.push({ label: dest.group, items: [dest] })
  }
  return groups
}

function destButton(dest, index) {
  const active = dest.key === state.prime.destKey
  const focused = state.prime.focus.zone === 'rail' && state.prime.focus.destIndex === index
  const button = el('button', primeChipClass(active || focused))
  button.type = 'button'
  button.dataset.primeDest = dest.key
  button.textContent = dest.label
  button.addEventListener('click', () => {
    state.prime.focus = { ...state.prime.focus, zone: 'rail', destIndex: index }
    void openPrimeDest(dest.key)
  })
  return button
}

function destRail() {
  const nav = el('nav', 'flex w-[240px] shrink-0 flex-col gap-4 overflow-y-auto')
  let index = 0
  for (const group of groupedDests(state.prime.dests)) {
    const block = el('div', 'grid gap-2')
    block.append(el('p', 'm-0 text-[11px] tracking-[0.12em] text-mute uppercase', group.label))
    for (const dest of group.items) {
      block.append(destButton(dest, index))
      index += 1
    }
    nav.append(block)
  }
  return nav
}

function cardClass(focused) {
  const base =
    'group w-[240px] shrink-0 cursor-pointer overflow-hidden rounded-lg bg-panel text-left md:w-[280px]'
  return focused ? `${base} ring-2 ring-accent` : base
}

function cardPoster(card) {
  const art = el('div', 'relative aspect-video bg-well bg-cover bg-center')
  if (card.coverUrl) art.style.backgroundImage = `url("${card.coverUrl}")`
  if (card.badge) {
    art.append(
      el(
        'span',
        'absolute top-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px]',
        card.badge,
      ),
    )
  }
  return art
}

function cardButton(card, rowIndex, cardIndex) {
  const focused =
    state.prime.focus.zone === 'rows' &&
    state.prime.focus.rowIndex === rowIndex &&
    state.prime.focus.cardIndex === cardIndex
  const button = el('button', cardClass(focused))
  button.type = 'button'
  button.dataset.primeCard = card.titleId
  button.append(cardPoster(card))
  const body = el('div', 'grid gap-1 p-3')
  body.append(el('h3', 'm-0 truncate font-display text-[16px] font-bold', card.title))
  if (card.entitlement) body.append(el('p', 'm-0 text-[12px] text-mute', card.entitlement))
  button.append(body)
  button.addEventListener('click', () => {
    state.prime.detail = card
    state.prime.focus = { ...state.prime.focus, zone: 'rows', rowIndex, cardIndex }
    state.redraw()
  })
  return button
}

function rowSection(row, rowIndex) {
  const section = el('section', 'grid gap-3')
  if (row.title) {
    section.append(el('h2', 'm-0 font-display text-[clamp(18px,1.6vw,26px)] font-bold', row.title))
  }
  const scroller = el('div', 'flex gap-3 overflow-x-auto pb-2')
  row.cards.forEach((card, cardIndex) => scroller.append(cardButton(card, rowIndex, cardIndex)))
  section.append(scroller)
  return section
}

function detailOverlay() {
  const card = state.prime.detail
  if (!card) return null
  const overlay = el('div', 'fixed inset-0 z-[70] grid place-items-center bg-black/70 p-6')
  overlay.id = 'primeDetail'
  const panel = el(
    'div',
    'grid max-h-[90vh] w-full max-w-[640px] gap-4 overflow-y-auto rounded-lg bg-panel p-6 ring-1 ring-line',
  )
  panel.append(el('h2', 'm-0 font-display text-[28px] font-bold', card.title))
  const meta = [card.year, card.runtime, card.badge].filter(Boolean).join(' · ')
  if (meta) panel.append(el('p', 'm-0 text-[14px] text-mute', meta))
  if (card.entitlement) panel.append(el('p', 'm-0 text-[14px] text-accent', card.entitlement))
  if (card.synopsis) panel.append(el('p', 'm-0 text-[15px] leading-relaxed', card.synopsis))
  const actions = el('div', 'flex flex-wrap gap-3')
  const play = el(
    'button',
    'cursor-pointer rounded-lg border-0 bg-action px-4 py-2 font-bold text-void',
    'Assistir no app',
  )
  play.type = 'button'
  play.id = 'primeDetailPlay'
  play.addEventListener('click', () => void playPrimeCard(card))
  const browser = el(
    'button',
    'cursor-pointer rounded-lg border-0 bg-row px-4 py-2 font-bold text-ink',
    'Abrir no navegador',
  )
  browser.type = 'button'
  browser.id = 'primeDetailBrowser'
  browser.addEventListener('click', () => void browsePrimeCard(card))
  actions.append(play, browser)
  panel.append(actions)
  const close = el(
    'button',
    'cursor-pointer rounded-lg border-0 bg-row px-4 py-2 font-bold',
    'Fechar',
  )
  close.type = 'button'
  close.id = 'primeDetailClose'
  close.addEventListener('click', () => {
    state.prime.detail = null
    state.redraw()
  })
  panel.append(close)
  overlay.append(panel)
  return overlay
}

function primeHead() {
  const head = el('div', 'grid max-w-[56ch] gap-2')
  head.append(
    el(
      'h1',
      'm-0 font-display text-[clamp(24px,2vw,34px)] font-bold tracking-tight',
      'Prime Video',
    ),
    el(
      'p',
      'm-0 max-w-[56ch] text-[13px] text-mute',
      'Catálogo nativo pelos endpoints da loja. O player oficial da Amazon toca no painel desta tela.',
    ),
  )
  const open = el(
    'button',
    'mt-2 w-fit cursor-pointer rounded-lg border-0 bg-action px-4 py-2 font-sans text-[15px] font-bold text-void',
    'Abrir Prime Video no app',
  )
  open.type = 'button'
  open.id = 'primeOpenBtn'
  open.addEventListener('click', () => void openPrimeStore())
  head.append(open)
  return head
}

function paneStage() {
  const wrap = el('div', 'mt-4 flex min-h-[70vh] flex-col gap-3')
  const bar = el('div', 'flex items-center justify-between gap-4')
  bar.append(
    el(
      'p',
      'm-0 truncate font-display text-[clamp(18px,1.6vw,26px)] font-bold',
      state.prime.pane.title || 'Prime Video',
    ),
  )
  const close = el(
    'button',
    'cursor-pointer rounded-lg border-0 bg-row px-4 py-2 font-bold text-ink',
    'Fechar player',
  )
  close.type = 'button'
  close.id = 'primePaneClose'
  close.addEventListener('click', () => void closePrimePane())
  bar.append(close)
  const host = el('div', 'min-h-[180px] min-w-[320px] w-full flex-1 bg-well')
  host.id = PANE_HOST_ID
  wrap.append(bar, host)
  return wrap
}

/** Trata setas/Enter/Escape na tela Prime. Devolve true se consumiu. */
export function handlePrimeKey(key) {
  const hasDetail = Boolean(state.prime.detail)
  const hasPane = panePlaying()
  const action = primeFocusAction(state.prime.focus, key, { hasDetail, hasPane })
  if (action === 'close-detail') {
    state.prime.detail = null
    state.redraw()
    return true
  }
  if (action === 'close-pane') {
    void closePrimePane()
    return true
  }
  if (action === 'play-detail') {
    if (state.prime.detail) void playPrimeCard(state.prime.detail)
    return true
  }
  if (action === 'open-dest') {
    const dest = state.prime.dests[state.prime.focus.destIndex]
    if (dest) void openPrimeDest(dest.key)
    return true
  }
  if (action === 'open-detail') {
    const card = state.prime.rows[state.prime.focus.rowIndex]?.cards[state.prime.focus.cardIndex]
    if (card) {
      state.prime.detail = card
      state.redraw()
    }
    return true
  }
  const next = movePrimeFocus(state.prime.focus, key, {
    destCount: state.prime.dests.length,
    rows: state.prime.rows,
    hasDetail,
    hasPane,
  })
  if (next === state.prime.focus) return false
  state.prime.focus = next
  state.redraw()
  return true
}

/** Desenha o catálogo nativo: trilho à esquerda, fileiras à direita. */
export function renderPrime() {
  const root = byId('prime')
  if (!root) return
  const visible = state.shell.screen === 'prime'
  document.body.classList.toggle('overflow-hidden', visible)
  root.hidden = !visible
  if (!visible) {
    void hidePrimePane()
    return
  }
  if (panePlaying()) {
    root.replaceChildren(paneStage())
    void syncPrimePane()
    return
  }
  const stage = el('div', 'mt-4 flex min-h-[70vh] gap-6')
  const rows = el('div', 'grid min-w-0 flex-1 gap-8 overflow-y-auto')
  if (state.prime.rows.length === 0) {
    const empty = state.errorText
      ? 'Não deu para carregar o catálogo. Confira a rede ou o cookie em Ajustes.'
      : 'Carregando o catálogo do Prime Video…'
    rows.append(el('p', 'm-0 text-[14px] text-mute', empty))
  }
  state.prime.rows.forEach((row, rowIndex) => rows.append(rowSection(row, rowIndex)))
  stage.append(destRail(), rows)
  const children = [primeHead(), stage]
  const overlay = detailOverlay()
  if (overlay) children.push(overlay)
  root.replaceChildren(...children)
  void syncPrimePane()
}
