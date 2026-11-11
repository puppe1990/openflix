export const CASA_TABS = [
  { id: 'for-you', label: 'Pra você' },
  { id: 'live', label: 'Ao vivo' },
  { id: 'apps', label: 'Apps' },
]

export const CASA_DOCK = [
  {
    id: 'openflix',
    label: 'OpenFlix',
    icon: './casa-icons/openflix.png',
    action: { type: 'openflix' },
  },
  {
    id: 'youtube',
    label: 'YouTube',
    icon: './casa-icons/youtube.png',
    action: { type: 'package', package: 'com.google.android.youtube.tv' },
  },
  {
    id: 'netflix',
    label: 'Netflix',
    pin: true,
    icon: './casa-icons/netflix.png',
    action: { type: 'package', package: 'com.netflix.mediaclient' },
  },
  {
    id: 'prime',
    label: 'Prime',
    icon: './casa-icons/prime.png',
    action: { type: 'openflix', screen: 'prime' },
  },
  {
    id: 'play',
    label: 'Play',
    icon: './casa-icons/play.png',
    action: { type: 'package', package: 'com.android.vending' },
  },
  {
    id: 'hdmi',
    label: 'HDMI',
    action: { type: 'package', package: 'com.bozee.usbdisplay' },
  },
  {
    id: 'files',
    label: 'Arquivos',
    action: { type: 'package', package: 'com.rockchips.mediacenter' },
  },
  {
    id: 'settings',
    label: 'Ajustes',
    action: { type: 'package', package: 'com.android.tv.settings' },
  },
  { id: 'apps', label: 'Aplicações', action: { type: 'apps' } },
]

function wrap(index, dir, length) {
  if (length <= 0) return 0
  return (index + dir + length) % length
}

function firstCard(list) {
  return Array.isArray(list) && list[0] ? list[0] : null
}

/** Relógio da Casa em Brasília, independente do fuso do aparelho. */
export function casaClock(now = new Date()) {
  return now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  })
}

/** Herói da Casa: resume, favorito ou cartaz frio. */
export function casaHero({ history = [], favs = [] } = {}) {
  const resume = firstCard(history)
  if (resume) {
    return {
      kind: 'resume',
      kicker: 'CONTINUAR',
      name: resume.name,
      cta: 'Assistir agora',
      card: resume,
    }
  }
  const featured = firstCard(favs)
  if (featured) {
    return {
      kind: 'featured',
      kicker: 'DESTAQUE',
      name: featured.name,
      cta: 'Assistir agora',
      card: featured,
    }
  }
  return { kind: 'cold', kicker: 'OPENFLIX', name: 'OpenFlix', cta: 'Assistir agora', card: null }
}

/** Trilhos Continuar e Recomendados. */
export function casaRails({ history = [], favs = [] } = {}) {
  const continueRow = Array.isArray(history) ? history.slice(0, 8) : []
  const recommended = (favs.length ? favs : continueRow.slice(1)).slice(0, 8)
  return { continueRow, recommended }
}

/** Fileiras visíveis do D-pad, na ordem de cima pra baixo. */
export function casaRailRows(rails) {
  const rows = []
  if (rails?.continueRow?.length) {
    rows.push({ title: 'Continuar assistindo', cards: rails.continueRow })
  }
  if (rails?.recommended?.length) {
    rows.push({ title: 'Recomendados', cards: rails.recommended })
  }
  return rows
}

function dockVisible(item, { packages, hdmi }) {
  if (item.pin) return true
  if (item.action.type === 'openflix' || item.action.type === 'apps') return true
  if (item.action.type === 'hdmi') return hdmi === true
  if (item.action.type === 'package') return packages.includes(item.action.package)
  return false
}

/** Dock só com o que o aparelho consegue abrir. */
export function visibleDock({ packages = [], hdmi = false } = {}) {
  return CASA_DOCK.filter((item) => dockVisible(item, { packages, hdmi }))
}

export function createCasaShell() {
  return {
    tab: 'for-you',
    zone: 'hero',
    tabIndex: 0,
    railIndex: 0,
    railItem: 0,
    dockIndex: 0,
    appsIndex: 0,
    toast: null,
  }
}

function playAction(card) {
  const play = card?.streamId
  return play ? { type: 'openflix', play } : { type: 'openflix' }
}

function railAt(rails, index) {
  return casaRailRows(rails)[index]?.cards ?? []
}

function clampRail(shell, rails, railIndex) {
  const row = railAt(rails, railIndex)
  if (!row.length) return { ...shell, railIndex: 0, railItem: 0 }
  return {
    ...shell,
    railIndex,
    railItem: Math.min(Math.max(0, shell.railItem ?? 0), row.length - 1),
  }
}

function activate(shell, { hero, dock, rails }) {
  if (shell.zone === 'hero') return { shell, action: playAction(hero?.card) }
  if (shell.zone === 'tabs') {
    const tab = CASA_TABS[shell.tabIndex] ?? CASA_TABS[0]
    if (tab.id === 'apps') return { shell: { ...shell, zone: 'apps' }, action: null }
    if (tab.id === 'live') return { shell, action: { type: 'openflix' } }
    return { shell, action: null }
  }
  if (shell.zone === 'dock') {
    const item = dock[shell.dockIndex] ?? dock[0]
    if (!item) return { shell, action: null }
    if (item.action.type === 'apps') return { shell: { ...shell, zone: 'apps' }, action: null }
    return { shell, action: { ...item.action } }
  }
  if (shell.zone === 'rails') {
    const row = railAt(rails, shell.railIndex ?? 0)
    return { shell, action: playAction(row[shell.railItem ?? 0]) }
  }
  return { shell, action: null }
}

function moveVertical(shell, dir, rails, dock) {
  const rows = casaRailRows(rails)
  if (shell.zone === 'rails' && rows.length) {
    const nextRow = (shell.railIndex ?? 0) + dir
    if (nextRow >= 0 && nextRow < rows.length) return clampRail(shell, rails, nextRow)
  }
  const order = ['tabs', 'hero']
  if (rows.length) order.push('rails')
  if (dock?.length) order.push('dock')
  const at = order.indexOf(shell.zone)
  if (at < 0) return { ...shell, zone: 'hero' }
  const next = at + dir
  if (next < 0 || next >= order.length) return shell
  const moved = { ...shell, zone: order[next] }
  if (moved.zone !== 'rails') return moved
  return clampRail(moved, rails, dir > 0 ? 0 : rows.length - 1)
}

function moveHorizontal(shell, dir, dock, rails) {
  if (shell.zone === 'tabs') {
    const tabIndex = wrap(shell.tabIndex ?? 0, dir, CASA_TABS.length)
    return { ...shell, tabIndex, tab: CASA_TABS[tabIndex].id }
  }
  if (shell.zone === 'dock' && dock?.length) {
    return { ...shell, dockIndex: wrap(shell.dockIndex ?? 0, dir, dock.length) }
  }
  if (shell.zone === 'rails') {
    const row = railAt(rails, shell.railIndex ?? 0)
    const max = Math.max(0, row.length - 1)
    return {
      ...shell,
      railIndex: shell.railIndex ?? 0,
      railItem: Math.min(Math.max(0, (shell.railItem ?? 0) + dir), max),
    }
  }
  return shell
}

/** D-pad da Casa. action null = só move o foco. */
export function handleCasaKey(shell, key, { hero, rails, dock } = {}) {
  if (key === 'Escape' || key === 'Backspace') {
    if (shell.zone === 'apps') return { shell: { ...shell, zone: 'hero' }, action: null }
    return { shell, action: null }
  }
  if (key === 'Enter') return activate(shell, { hero, dock, rails })
  if (key === 'ArrowDown') return { shell: moveVertical(shell, 1, rails, dock), action: null }
  if (key === 'ArrowUp') return { shell: moveVertical(shell, -1, rails, dock), action: null }
  if (key === 'ArrowRight') return { shell: moveHorizontal(shell, 1, dock, rails), action: null }
  if (key === 'ArrowLeft') return { shell: moveHorizontal(shell, -1, dock, rails), action: null }
  return { shell, action: null }
}

/** Voltar no Início do OpenFlix devolve o Android à Casa. */
export function shouldLeaveToCasa(shell, key) {
  if (key !== 'Escape' && key !== 'Backspace') return false
  return shell?.screen === 'home'
}

/** JavascriptInterface só aceita chamada no objeto injetado. */
export function callHouse(name, arg) {
  const house = globalThis.OpenFlixHouse
  if (!house || typeof house[name] !== 'function') return undefined
  if (arg === undefined) return house[name]()
  return house[name](arg)
}
