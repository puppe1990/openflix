import { withAllCategory } from './allCategory.mjs'

export const HOME_TILES = [
  { id: 'live', label: 'Ao vivo' },
  { id: 'movies', label: 'Filmes' },
  { id: 'series', label: 'Séries' },
  { id: 'settings', label: 'Ajustes' },
]

/** Abas do header 10-foot (Início → Ajustes). */
export const MENU_TABS = [
  { id: 'inicio', screen: 'home' },
  { id: 'live', screen: 'catalog', catalogKind: 'live' },
  { id: 'movies', screen: 'catalog', catalogKind: 'movies' },
  { id: 'series', screen: 'catalog', catalogKind: 'series' },
  { id: 'prime', screen: 'prime' },
  { id: 'youtube', screen: 'youtube' },
  { id: 'settings', screen: 'settings' },
]

function wrap(index, dir, length) {
  return (index + dir + length) % length
}

function tileAt(index) {
  return HOME_TILES[index]
}

function listingKind(kind) {
  return kind === 'live' || kind === 'movies' || kind === 'series'
}

/** Shell 10-foot: home live|movies|series|settings (HomeType do FlexTV). */
export function createTvShell() {
  return {
    screen: 'home',
    homeIndex: 0,
    homeId: 'live',
    menuIndex: 0,
    focus: 'menu',
    catalogKind: null,
    catalog: null,
    categoryIndex: 0,
    itemIndex: 0,
    selectedItem: null,
  }
}

export function focusHome(shell, id) {
  const homeIndex = HOME_TILES.findIndex((tile) => tile.id === id)
  if (homeIndex < 0) {
    throw new Error(`tile recusado: recebido ${id}, esperado live, movies, series ou settings`)
  }
  return { ...shell, homeIndex, homeId: id }
}

export function moveHome(shell, dir) {
  const homeIndex = wrap(shell.homeIndex, dir, HOME_TILES.length)
  return { ...shell, homeIndex, homeId: tileAt(homeIndex).id }
}

export function openHomeTile(shell) {
  const tile = tileAt(shell.homeIndex)
  if (tile.id === 'settings') return { ...shell, screen: 'settings', focus: 'list' }
  if (shell.catalogKind === tile.id && shell.catalog) {
    return { ...shell, screen: 'catalog', focus: 'list' }
  }
  return {
    ...shell,
    screen: 'catalog',
    focus: 'list',
    catalogKind: tile.id,
    catalog: null,
    categoryIndex: 0,
    itemIndex: 0,
    selectedItem: null,
  }
}

export function bindCatalog(shell, catalog) {
  const next = { ...catalog, categories: withAllCategory(catalog.categories) }
  const items = next.categories[0]?.items ?? []
  return {
    ...shell,
    catalog: next,
    categoryIndex: 0,
    itemIndex: 0,
    selectedItem: items[0] ?? null,
  }
}

export function moveCatalog(shell, dir) {
  const items = shell.catalog?.categories[shell.categoryIndex]?.items ?? []
  if (items.length === 0) return shell
  const itemIndex = wrap(shell.itemIndex, dir, items.length)
  return { ...shell, itemIndex, selectedItem: items[itemIndex] }
}

export function moveMenu(shell, dir) {
  const menuIndex = wrap(shell.menuIndex ?? 0, dir, MENU_TABS.length)
  return { ...shell, menuIndex, focus: 'menu' }
}

export function openMenuTab(shell) {
  const tab = MENU_TABS[shell.menuIndex ?? 0]
  if (!tab) return shell
  if (tab.screen === 'home') {
    if (shell.screen === 'home') return shell
    return { ...shell, screen: 'home', focus: 'menu' }
  }
  if (tab.screen === 'catalog') {
    const homeIndex = HOME_TILES.findIndex((tile) => tile.id === tab.catalogKind)
    return openHomeTile({ ...shell, homeIndex, homeId: tab.catalogKind })
  }
  return { ...shell, screen: tab.screen, focus: 'list' }
}

export function goBack(shell) {
  if (shell.screen === 'home') return shell
  if (shell.screen === 'player' && shell.catalog && listingKind(shell.catalogKind)) {
    return { ...shell, screen: 'catalog', focus: 'list' }
  }
  return { ...shell, screen: 'home', focus: 'menu' }
}

function handleCatalogKey(shell, key) {
  if (shell.focus === 'menu') {
    if (key === 'ArrowRight') return moveMenu(shell, 1)
    if (key === 'ArrowLeft') return moveMenu(shell, -1)
    if (key === 'Enter') return openMenuTab(shell)
    if (key === 'ArrowDown') return { ...shell, focus: 'list' }
    return shell
  }
  if (key === 'ArrowRight') return moveMenu(shell, 1)
  if (key === 'ArrowLeft') return moveMenu(shell, -1)
  if (key === 'ArrowDown') return moveCatalog(shell, 1)
  if (key === 'ArrowUp') {
    if ((shell.itemIndex ?? 0) === 0) return { ...shell, focus: 'menu' }
    return moveCatalog(shell, -1)
  }
  if (key === 'Enter' && shell.selectedItem) return { ...shell, screen: 'player' }
  return shell
}

export function handleKey(shell, key) {
  if (shell.screen === 'home') {
    if (key === 'ArrowRight') return moveMenu(shell, 1)
    if (key === 'ArrowLeft') return moveMenu(shell, -1)
    if (key === 'Enter') return openMenuTab(shell)
    return shell
  }
  if (key === 'Escape' || key === 'Backspace') return goBack(shell)
  if (shell.screen === 'catalog') return handleCatalogKey(shell, key)
  return shell
}
