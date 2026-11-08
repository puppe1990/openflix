import { withAllCategory } from './allCategory.mjs'

export const HOME_TILES = [
  { id: 'live', label: 'Ao vivo' },
  { id: 'movies', label: 'Filmes' },
  { id: 'series', label: 'Séries' },
  { id: 'settings', label: 'Ajustes' },
]

function wrap(index, dir, length) {
  return (index + dir + length) % length
}

function tileAt(index) {
  return HOME_TILES[index]
}

/** Shell 10-foot: home live|movies|series|settings (HomeType do FlexTV). */
export function createTvShell() {
  return {
    screen: 'home',
    homeIndex: 0,
    homeId: 'live',
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
  if (tile.id === 'settings') return { ...shell, screen: 'settings' }
  if (shell.catalogKind === tile.id && shell.catalog) {
    return { ...shell, screen: 'catalog' }
  }
  return {
    ...shell,
    screen: 'catalog',
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

export function goBack(shell) {
  if (shell.screen === 'home') return shell
  return { ...shell, screen: 'home' }
}

export function handleKey(shell, key) {
  if (shell.screen === 'home') {
    if (key === 'ArrowRight') return moveHome(shell, 1)
    if (key === 'ArrowLeft') return moveHome(shell, -1)
    if (key === 'Enter') return openHomeTile(shell)
    return shell
  }
  if (key === 'Escape' || key === 'Backspace') return goBack(shell)
  if (shell.screen === 'catalog' && key === 'ArrowDown') return moveCatalog(shell, 1)
  if (shell.screen === 'catalog' && key === 'ArrowUp') return moveCatalog(shell, -1)
  if (shell.screen === 'catalog' && key === 'Enter' && shell.selectedItem) {
    return { ...shell, screen: 'player' }
  }
  return shell
}
