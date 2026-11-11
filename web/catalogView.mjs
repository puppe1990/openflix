import { withAllCategory } from '../src/allCategory.mjs'
import { filterCategories } from '../src/catalogFilter.mjs'
import {
  CHANNEL_CARD_PAGE,
  channelLayoutLabel,
  growCardLimit,
  itemsToPaint,
  nextChannelLayout,
  shouldGrowItems,
} from '../src/channelLayout.mjs'
import { channelMark } from '../src/channelMark.mjs'
import { epgProgress } from '../src/epgProgress.mjs'
import { nowAndNext } from '../src/xmltvNowNext.mjs'
import { HOME_TILES, MENU_TABS } from '../src/tvShell.mjs'
import { itemFromWatchCard, watchCardFromItem } from '../src/watchCard.mjs'
import {
  catalogDetailClass,
  catalogGridClass,
  catalogListsClass,
  catCountClass,
  favToggleClass,
  catItemClass,
  catListClass,
  ghostClass,
  itemCardClass,
  itemClass,
  itemListClass,
  itemsPaneClass,
  liveBadgeClass,
  tabClass,
  tileClass,
} from '../src/tvSkin.mjs'
import { byId, el } from './dom.mjs'
import { renderHomeRows } from './homeRows.mjs'
import { ICON_GRID, ICON_HEART, ICON_LIST, iconSvg } from './icons.mjs'
import { fillGuide } from './session.mjs'
import { transitionTo } from './screenFlow.mjs'
import { state } from './state.mjs'
import { favStore, historyStore } from './stores.mjs'

const TAB_SCREENS = {
  'tab-inicio': 'home',
  'tab-live': 'live',
  'tab-movies': 'movies',
  'tab-series': 'series',
  'tab-prime': 'prime',
  'tab-youtube': 'youtube',
  'tab-settings': 'settings',
}

const FEATURED_KIND = { live: 'Ao vivo', movies: 'Filme', series: 'Série' }

function actionButton(className, icon, label, onClick) {
  const button = el('button', className)
  button.type = 'button'
  button.append(iconSvg(icon, 16), document.createTextNode(` ${label}`))
  button.addEventListener('click', onClick)
  return button
}

function progressBar(fraction, widthClass = 'w-32') {
  const track = el('div', `mt-1.5 h-1 overflow-hidden rounded-full bg-well ${widthClass}`)
  const fill = el('div', 'h-full bg-accent')
  fill.style.width = `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`
  track.append(fill)
  return track
}

function itemMark(item) {
  const box = el(
    'div',
    'flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-well font-display text-[15px] font-bold text-accent',
  )
  if (item.icon) {
    const image = el('img', 'h-full w-full object-contain')
    image.src = item.icon
    image.alt = ''
    box.append(image)
    return box
  }
  box.textContent = channelMark(item.name)
  return box
}

function artUrl(entry) {
  return entry?.backdrop || entry?.poster || entry?.icon || ''
}

function renderFeatured() {
  const featured = state.featured
  if (!featured) return []
  const card = el('article', 'relative overflow-hidden rounded-lg bg-well')
  const art = artUrl(featured)
  if (art) {
    const backdrop = el('div', 'absolute inset-0 bg-cover bg-center')
    backdrop.style.backgroundImage = `url("${art}")`
    card.append(backdrop)
  } else {
    card.append(el('div', 'absolute inset-0 bg-linear-to-br from-accent/25 via-void to-void'))
  }
  card.append(el('div', 'absolute inset-0 bg-linear-to-t from-void via-void/70 to-black/40'))
  const content = el(
    'div',
    'relative flex min-h-[280px] flex-col justify-end gap-3 p-6 md:min-h-[420px] md:p-10',
  )
  const kind = FEATURED_KIND[featured.kind]
  if (kind) content.append(el('span', liveBadgeClass(), kind))
  content.append(
    el(
      'h2',
      'm-0 max-w-[22ch] font-display text-[clamp(32px,4vw,56px)] font-black tracking-tight',
      featured.name,
    ),
  )
  if (featured.plot) {
    content.append(el('p', 'm-0 max-w-[62ch] text-[15px] text-mute', featured.plot))
  }
  card.append(content)
  return [card]
}

export function renderHome() {
  const root = byId('home')
  root.hidden = state.shell.screen !== 'home'
  if (root.hidden) return
  const tiles = el('div', 'grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6')
  tiles.append(
    ...HOME_TILES.map((tile) => {
      const button = el('button', tileClass(tile.id === state.shell.homeId), tile.label)
      button.type = 'button'
      button.setAttribute('aria-selected', String(tile.id === state.shell.homeId))
      button.dataset.tile = tile.id
      return button
    }),
  )
  root.replaceChildren(
    ...renderFeatured(),
    tiles,
    ...renderHomeRows({
      history: historyStore.list(),
      favs: favStore.listFavs(),
      onOpen: openHomeItem,
    }),
  )
}

/** Abre o player a partir de um retrato da home. */
export function openHomeItem(card) {
  void transitionTo({
    ...state.shell,
    catalogKind: card.catalogKind,
    selectedItem: itemFromWatchCard(card),
    screen: 'player',
  })
}

function menuTabName(tab) {
  return tab?.catalogKind ?? tab?.screen
}

/** Marca a aba ativa pelo estado atual. */
export function renderTabs() {
  const { shell } = state
  const active = shell.screen === 'catalog' ? shell.catalogKind : shell.screen
  const menuOn = shell.screen === 'home' || shell.focus === 'menu'
  const focused = menuOn ? MENU_TABS[shell.menuIndex ?? 0] : null
  for (const [id, name] of Object.entries(TAB_SCREENS)) {
    const tab = byId(id)
    if (tab)
      tab.className = tabClass(active === name, Boolean(focused && menuTabName(focused) === name))
  }
}

function currentCategory() {
  return state.shell.catalog?.categories?.[state.shell.categoryIndex] ?? null
}

/** Seleciona uma categoria e seu primeiro item. */
export function selectCategory(index) {
  const category = state.shell.catalog?.categories?.[index]
  if (!category) return
  state.itemLimit = CHANNEL_CARD_PAGE
  state.shell = {
    ...state.shell,
    categoryIndex: index,
    itemIndex: 0,
    selectedItem: category.items[0] ?? null,
  }
  state.redraw()
}

/** Seleciona um item e abre o player. */
export function selectItem(item) {
  const index = (currentCategory()?.items ?? []).findIndex((candidate) => candidate.id === item.id)
  void transitionTo({
    ...state.shell,
    itemIndex: Math.max(0, index),
    selectedItem: item,
    screen: 'player',
  })
}

function renderCategories(categories) {
  const list = byId('categories')
  const kind = state.shell.catalogKind
  list.className = catListClass(kind)
  list.replaceChildren()
  for (const category of categories) {
    const selected = category.sourceIndex === state.shell.categoryIndex
    const row = el('li', catItemClass(selected, kind))
    row.setAttribute('aria-selected', String(selected))
    row.append(
      el('span', '', category.name),
      el('span', catCountClass(), String(category.items.length)),
    )
    row.addEventListener('click', () => selectCategory(category.sourceIndex))
    list.append(row)
  }
}

function listingOf(item) {
  const fromGuide = nowAndNext(state.guide?.byChannel ?? state.guide?.programs, {
    channelId: item.epgChannelId,
    now: state.guide?.now ?? Date.now(),
  })
  if (fromGuide) return fromGuide
  if (state.epg.key !== String(item.id)) return null
  return state.epg.listings[0] ?? null
}

function liveLayout() {
  return state.channelLayout === 'card' ? 'card' : 'list'
}

function renderItemsToolbar() {
  const bar = byId('items-toolbar')
  bar.hidden = false
  bar.className = 'flex shrink-0 justify-end'
  const layout = liveLayout()
  const button = actionButton(
    ghostClass(),
    layout === 'card' ? ICON_LIST : ICON_GRID,
    channelLayoutLabel(layout),
    () => {
      state.channelLayout = nextChannelLayout(layout)
      state.itemLimit = CHANNEL_CARD_PAGE
      state.redraw()
    },
  )
  button.dataset.channelLayout = layout
  bar.replaceChildren(button)
}

function favToggle(item, overlay = false) {
  const on = favStore.isFav(item.id)
  const button = el('button', favToggleClass(on, overlay))
  button.type = 'button'
  button.dataset.listFav = String(item.id)
  button.setAttribute('aria-pressed', String(on))
  button.setAttribute('aria-label', on ? 'Remover favorito' : 'Favoritar')
  button.append(iconSvg(ICON_HEART, 16))
  button.addEventListener('click', (event) => {
    event.stopPropagation()
    favStore.toggleFav(item.id, watchCardFromItem(item, state.shell.catalogKind))
    state.redraw()
  })
  return button
}

function renderChannelRow(item, index, selected, live) {
  const row = el('li', itemClass(selected))
  row.setAttribute('aria-selected', String(selected))
  row.append(
    el(
      'span',
      `w-7 shrink-0 font-mono text-[12px] font-bold ${selected ? 'text-accent' : 'text-mute'}`,
      String(index + 1).padStart(2, '0'),
    ),
    itemMark(item),
  )
  const body = el('div', 'min-w-0 flex-1')
  body.append(el('span', 'block truncate font-display text-[15px] font-bold', item.name))
  const listing = live ? listingOf(item) : null
  if (listing) {
    body.append(el('p', 'm-0 truncate text-[12px] text-mute', listing.title))
    body.append(progressBar(epgProgress(listing)))
  }
  row.append(body)
  row.append(favToggle(item))
  if (live && selected) row.append(el('span', liveBadgeClass(), 'No ar'))
  row.addEventListener('click', () => selectItem(item))
  return row
}

function renderChannelCard(item, index, selected, live) {
  const card = el('li', itemCardClass(selected))
  card.setAttribute('aria-selected', String(selected))
  const art = el('div', 'relative aspect-square min-h-28 bg-well')
  if (item.icon) {
    const image = el('img', 'h-full w-full object-contain p-3')
    image.src = item.icon
    image.alt = ''
    image.loading = 'lazy'
    image.decoding = 'async'
    art.append(image)
  } else {
    art.append(
      el(
        'div',
        'flex h-full items-center justify-center font-display text-[28px] font-black text-accent',
        channelMark(item.name),
      ),
    )
  }
  art.append(
    el(
      'span',
      'absolute top-2 left-2 font-mono text-[11px] font-bold text-mute',
      String(index + 1).padStart(2, '0'),
    ),
  )
  if (live && selected) {
    art.append(el('span', `${liveBadgeClass()} absolute top-2 right-2`, 'No ar'))
  }
  art.append(favToggle(item, true))
  const caption = el(
    'span',
    'block truncate px-2 pt-2 font-display text-[13px] font-bold',
    item.name,
  )
  card.append(art, caption)
  const listing = live ? listingOf(item) : null
  if (listing) {
    card.append(el('p', 'm-0 truncate px-2 pb-2 text-[11px] text-mute', listing.title))
  } else {
    caption.classList.add('pb-2')
  }
  card.addEventListener('click', () => selectItem(item))
  return card
}

function renderItems(categories) {
  const list = byId('items')
  const kind = state.shell.catalogKind
  const layout = liveLayout()
  list.className = itemListClass(kind, layout)
  const category = categories.find((entry) => entry.sourceIndex === state.shell.categoryIndex)
  const all = category?.items ?? []
  const shown = itemsToPaint(all, layout, state.itemLimit)
  const live = kind === 'live'
  const paint = layout === 'card' ? renderChannelCard : renderChannelRow
  const top = list.scrollTop
  list.replaceChildren()
  for (const [index, item] of shown.entries()) {
    const selected = item.id === state.shell.selectedItem?.id
    list.append(paint(item, index, selected, live))
  }
  list.scrollTop = top
  list.onscroll = () => {
    if (!shouldGrowItems(list)) return
    const next = growCardLimit(state.itemLimit, all.length)
    if (next === state.itemLimit) return
    state.itemLimit = next
    renderItems(categories)
  }
}

/** Desenha categorias e itens do catálogo. */
export function renderCatalog() {
  const visible = state.shell.screen === 'catalog'
  byId('catalog').hidden = !visible
  if (!visible) return
  const kind = state.shell.catalogKind
  byId('catalog-grid').className = catalogGridClass(kind)
  byId('detail').className = catalogDetailClass(kind)
  byId('catalog-lists').className = catalogListsClass(kind)
  byId('items-pane').className = itemsPaneClass(kind)
  const catalogCats = withAllCategory(state.shell.catalog?.categories)
  if (state.shell.catalog && catalogCats !== state.shell.catalog.categories) {
    state.shell = { ...state.shell, catalog: { ...state.shell.catalog, categories: catalogCats } }
  }
  const categories = filterCategories(catalogCats, byId('search')?.value)
  renderCategories(categories)
  renderItemsToolbar()
  if (kind === 'live') void fillGuide()
  renderItems(categories)
  byId('shelf').replaceChildren()
}
