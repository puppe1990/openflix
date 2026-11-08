import { playableYoutubeItem } from '../src/youtubePlay.mjs'
import { createYoutubeFocus, moveYoutubeFocus, youtubeFocusAction } from '../src/youtubeFocus.mjs'
import { primeChipClass } from '../src/tvSkin.mjs'
import { byId, el } from './dom.mjs'
import { formatYoutubeError, loadYoutubePlayback, loadYoutubeProxyBase } from './youtubeClient.mjs'
import { openYoutubeDest } from './youtubeVideo.mjs'
import { openYoutubeSignIn } from './youtubeWindow.mjs'
import { transitionTo } from './screenFlow.mjs'
import { state } from './state.mjs'

async function runYoutube(action) {
  try {
    await action()
    state.errorText = ''
  } catch (error) {
    state.errorText = formatYoutubeError(error)
  }
  state.redraw()
}

/** Toca o card no player nativo via proxy localhost. */
export async function playYoutubeCard(card) {
  state.youtube.detail = null
  try {
    const playback = await loadYoutubePlayback(card.videoId)
    const base = await loadYoutubeProxyBase()
    const item = playableYoutubeItem(card, base, playback)
    state.errorText = ''
    await transitionTo({ ...state.shell, selectedItem: item, screen: 'player' })
  } catch (error) {
    state.errorText = formatYoutubeError(error)
    state.redraw()
  }
}

function destButton(dest, index) {
  const active = dest.key === state.youtube.destKey
  const focused = state.youtube.focus.zone === 'rail' && state.youtube.focus.destIndex === index
  const button = el('button', primeChipClass(active || focused))
  button.type = 'button'
  button.dataset.youtubeDest = dest.key
  button.textContent = dest.label
  button.addEventListener('click', () => {
    state.youtube.focus = { ...state.youtube.focus, zone: 'rail', destIndex: index }
    void openYoutubeDest(dest.key)
  })
  return button
}

function destRail() {
  const nav = el('nav', 'flex w-[240px] shrink-0 flex-col gap-4 overflow-y-auto')
  const block = el('div', 'grid gap-2')
  block.append(el('p', 'm-0 text-[11px] tracking-[0.12em] text-mute uppercase', 'YouTube'))
  state.youtube.dests.forEach((dest, index) => block.append(destButton(dest, index)))
  nav.append(block)
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
  if (card.length) {
    art.append(
      el(
        'span',
        'absolute right-2 bottom-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px]',
        card.length,
      ),
    )
  }
  return art
}

function cardButton(card, rowIndex, cardIndex) {
  const focused =
    state.youtube.focus.zone === 'rows' &&
    state.youtube.focus.rowIndex === rowIndex &&
    state.youtube.focus.cardIndex === cardIndex
  const button = el('button', cardClass(focused))
  button.type = 'button'
  button.dataset.youtubeCard = card.videoId
  button.append(cardPoster(card))
  const body = el('div', 'grid gap-1 p-3')
  body.append(el('h3', 'm-0 truncate font-display text-[16px] font-bold', card.title))
  if (card.channel) body.append(el('p', 'm-0 truncate text-[12px] text-mute', card.channel))
  button.append(body)
  button.addEventListener('click', () => {
    state.youtube.detail = card
    state.youtube.focus = { ...state.youtube.focus, zone: 'rows', rowIndex, cardIndex }
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
  const card = state.youtube.detail
  if (!card) return null
  const overlay = el('div', 'fixed inset-0 z-[70] grid place-items-center bg-black/70 p-6')
  overlay.id = 'youtubeDetail'
  const panel = el(
    'div',
    'grid max-h-[90vh] w-full max-w-[640px] gap-4 overflow-y-auto rounded-lg bg-panel p-6 ring-1 ring-line',
  )
  panel.append(el('h2', 'm-0 font-display text-[28px] font-bold', card.title))
  const meta = [card.channel, card.length, card.badge].filter(Boolean).join(' · ')
  if (meta) panel.append(el('p', 'm-0 text-[14px] text-mute', meta))
  const play = el(
    'button',
    'cursor-pointer rounded-lg border-0 bg-action px-4 py-2 font-bold text-void',
    'Assistir',
  )
  play.type = 'button'
  play.id = 'youtubeDetailPlay'
  play.addEventListener('click', () => void playYoutubeCard(card))
  const close = el(
    'button',
    'cursor-pointer rounded-lg border-0 bg-row px-4 py-2 font-bold',
    'Fechar',
  )
  close.type = 'button'
  close.id = 'youtubeDetailClose'
  close.addEventListener('click', () => {
    state.youtube.detail = null
    state.redraw()
  })
  panel.append(play, close)
  overlay.append(panel)
  return overlay
}

function youtubeHead() {
  const head = el('div', 'grid max-w-[56ch] gap-2')
  head.append(
    el('h1', 'm-0 font-display text-[clamp(24px,2vw,34px)] font-bold tracking-tight', 'YouTube'),
    el(
      'p',
      'm-0 max-w-[56ch] text-[13px] text-mute',
      'Catálogo nativo pelo Innertube. O player do OpenFlix toca o vídeo pelo proxy local.',
    ),
  )
  const open = el(
    'button',
    'mt-2 w-fit cursor-pointer rounded-lg border-0 bg-action px-4 py-2 font-sans text-[15px] font-bold text-void',
    'Entrar no YouTube',
  )
  open.type = 'button'
  open.id = 'youtubeOpenBtn'
  open.addEventListener('click', () => void runYoutube(openYoutubeSignIn))
  head.append(open)
  return head
}

function focusedCard() {
  const { rowIndex, cardIndex } = state.youtube.focus
  return state.youtube.rows[rowIndex]?.cards[cardIndex]
}

/** Trata setas/Enter/Escape na tela YouTube. Devolve true se consumiu. */
export function handleYoutubeKey(key) {
  const hasDetail = Boolean(state.youtube.detail)
  const action = youtubeFocusAction(state.youtube.focus, key, { hasDetail })
  if (action === 'close-detail') {
    state.youtube.detail = null
    state.redraw()
    return true
  }
  if (action === 'play-detail') {
    if (state.youtube.detail) void playYoutubeCard(state.youtube.detail)
    return true
  }
  if (action === 'open-dest') {
    const dest = state.youtube.dests[state.youtube.focus.destIndex]
    if (dest) void openYoutubeDest(dest.key)
    return true
  }
  if (action === 'play-card') {
    const card = focusedCard()
    if (card) void playYoutubeCard(card)
    return true
  }
  const next = moveYoutubeFocus(state.youtube.focus, key, {
    destCount: state.youtube.dests.length,
    rows: state.youtube.rows,
    hasDetail,
  })
  if (next === state.youtube.focus) return false
  state.youtube.focus = next
  state.redraw()
  return true
}

/** Desenha o catálogo nativo: trilho à esquerda, fileiras à direita. */
export function renderYoutube() {
  const root = byId('youtube')
  if (!root) return
  const visible = state.shell.screen === 'youtube'
  root.hidden = !visible
  if (!visible) return
  if (!state.youtube.focus) state.youtube.focus = createYoutubeFocus()
  const stage = el('div', 'mt-4 flex min-h-[70vh] gap-6')
  const rows = el('div', 'grid min-w-0 flex-1 gap-8 overflow-y-auto')
  if (state.youtube.rows.length === 0) {
    const empty = state.errorText
      ? 'Não deu para carregar o catálogo. Abra o app Tauri e entre no YouTube em Ajustes.'
      : 'O Início do YouTube vem vazio sem sessão. Entre em Ajustes, ou busque no topo.'
    rows.append(el('p', 'm-0 text-[14px] text-mute', empty))
  }
  state.youtube.rows.forEach((row, rowIndex) => rows.append(rowSection(row, rowIndex)))
  stage.append(destRail(), rows)
  const children = [youtubeHead(), stage]
  const overlay = detailOverlay()
  if (overlay) children.push(overlay)
  root.replaceChildren(...children)
}
