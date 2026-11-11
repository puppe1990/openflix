import { channelMark } from '../src/channelMark.mjs'
import { CASA_TABS, casaRailRows } from '../src/casa.mjs'
import { el } from './dom.mjs'

function cssUrl(href) {
  return `url(${JSON.stringify(href)})`
}

function tabNode(tab, shell) {
  const node = el('button', shell.tab === tab.id ? 'casa-tab is-on' : 'casa-tab', tab.label)
  node.type = 'button'
  node.dataset.tab = tab.id
  return node
}

function heroNode(hero, focused) {
  const node = el('section', focused ? 'casa-hero is-focus' : 'casa-hero')
  node.dataset.zone = 'hero'
  const icon = hero.card?.icon
  if (icon) {
    node.style.backgroundImage = `linear-gradient(90deg, rgba(12,12,14,.9) 0%, rgba(12,12,14,.45) 50%, rgba(12,12,14,.2) 100%), ${cssUrl(icon)}`
    node.style.backgroundSize = 'cover'
    node.style.backgroundPosition = 'center'
  }
  node.append(el('p', 'casa-kicker', hero.kicker))
  node.append(el('h1', 'casa-title', hero.name))
  node.append(el('button', 'casa-cta', hero.cta))
  return node
}

function railCard(card, index, focused) {
  const node = el('button', focused ? 'casa-card is-focus' : 'casa-card')
  node.type = 'button'
  node.dataset.streamId = card.streamId
  node.dataset.railItem = String(index)
  const art = el('span', 'casa-card-art')
  if (card.icon) art.style.backgroundImage = cssUrl(card.icon)
  else art.textContent = channelMark(card.name)
  node.append(art)
  node.append(el('span', 'casa-card-name', card.name))
  return node
}

function railsNode(rails, shell) {
  const node = el('section', shell.zone === 'rails' ? 'casa-rails is-focus' : 'casa-rails')
  node.dataset.zone = 'rails'
  casaRailRows(rails).forEach((row, rowIndex) => {
    const wrap = el('div', 'casa-row')
    wrap.dataset.rail = String(rowIndex)
    wrap.append(el('h2', 'casa-row-title', row.title))
    const scroller = el('div', 'casa-scroller')
    scroller.append(
      ...row.cards.map((card, index) =>
        railCard(
          card,
          index,
          shell.zone === 'rails' &&
            (shell.railIndex ?? 0) === rowIndex &&
            (shell.railItem ?? 0) === index,
        ),
      ),
    )
    wrap.append(scroller)
    node.append(wrap)
  })
  return node
}

const DOCK_MARK = {
  openflix: 'OF',
  youtube: 'YT',
  prime: 'PV',
  play: '▶',
  hdmi: 'HDMI',
  files: 'ARQ',
  settings: '⚙',
  apps: '+',
}

function dockDot(item, focused) {
  const node = el('button', focused ? 'casa-dot is-focus' : 'casa-dot')
  node.type = 'button'
  node.dataset.dock = item.id
  node.setAttribute('aria-label', item.label)
  if (item.icon) {
    const img = el('img', 'casa-dot-icon')
    img.src = item.icon
    img.alt = ''
    node.append(img)
    return node
  }
  node.textContent = DOCK_MARK[item.id] || item.label
  return node
}

function dockNode(dock, shell) {
  const node = el('nav', shell.zone === 'dock' ? 'casa-dock is-focus' : 'casa-dock')
  node.dataset.zone = 'dock'
  node.append(
    ...dock.map((item, index) => dockDot(item, shell.zone === 'dock' && shell.dockIndex === index)),
  )
  return node
}

function chromeNode(clock, shell) {
  const node = el('header', shell.zone === 'tabs' ? 'casa-chrome is-focus' : 'casa-chrome')
  node.dataset.zone = 'tabs'
  const tabs = el('div', 'casa-tabs')
  tabs.append(...CASA_TABS.map((tab) => tabNode(tab, shell)))
  node.append(el('span', 'casa-clock', clock))
  node.append(tabs)
  return node
}

function toastNode(toast) {
  if (!toast) return null
  return el('p', 'casa-toast', toast)
}

function appsNode(apps, shell) {
  if (shell.zone !== 'apps') return null
  const node = el('section', 'casa-apps')
  node.dataset.zone = 'apps'
  node.append(el('h2', 'casa-row-title', 'Aplicações'))
  const grid = el('div', 'casa-apps-grid')
  for (const app of apps) {
    const button = el('button', 'casa-app', app.label)
    button.type = 'button'
    button.dataset.package = app.package
    grid.append(button)
  }
  node.append(grid)
  return node
}

/** Desenha a Casa 10-foot no root. */
export function renderCasa(root, { shell, hero, rails, dock, clock, toast, apps }) {
  const frame = el('div', 'casa-frame')
  frame.append(chromeNode(clock, shell))
  frame.append(heroNode(hero, shell.zone === 'hero'))
  frame.append(railsNode(rails, shell))
  frame.append(dockNode(dock, shell))
  const toastEl = toastNode(toast)
  if (toastEl) frame.append(toastEl)
  const appsEl = appsNode(apps ?? [], shell)
  if (appsEl) frame.append(appsEl)
  root.replaceChildren(frame)
}
