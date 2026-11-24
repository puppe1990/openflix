import {
  callHouse,
  casaClock,
  casaHero,
  casaRails,
  createCasaShell,
  handleCasaClick,
  handleCasaKey,
  visibleDock,
} from '../src/casa.mjs'
import { renderCasa } from './casaView.mjs'
import { loadStores, favStore, historyStore } from './stores.mjs'

const root = document.getElementById('casa')
let shell = createCasaShell()
let toastTimer = 0

function clockLabel() {
  return casaClock()
}

function readBridgeJson(name, fallback) {
  try {
    const raw = callHouse(name)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function model() {
  const installed = readBridgeJson('packages', { packages: [], hdmi: false })
  const history = historyStore.list()
  const favs = favStore.listFavs()
  return {
    hero: casaHero({ history, favs }),
    rails: casaRails({ history, favs }),
    dock: visibleDock(installed),
    clock: clockLabel(),
    toast: shell.toast,
    apps: readBridgeJson('apps', []),
  }
}

function draw() {
  renderCasa(root, { shell, ...model() })
}

function showToast(text) {
  shell = { ...shell, toast: text }
  draw()
  globalThis.clearTimeout(toastTimer)
  toastTimer = globalThis.setTimeout(() => {
    shell = { ...shell, toast: null }
    draw()
  }, 3000)
}

function perform(action) {
  if (!action) return
  const payload = JSON.stringify(action)
  console.log('casa launch', payload)
  const result = callHouse('launch', payload)
  if (result !== 'ok') {
    showToast(`Não abriu ${action.package || action.type}`)
  }
}

function onKey(event) {
  const next = handleCasaKey(shell, event.key, model())
  shell = next.shell
  draw()
  perform(next.action)
  event.preventDefault()
}

function casaClickHit(node) {
  const tab = node.closest?.('[data-tab]')
  if (tab?.dataset.tab) return { zone: 'tabs', tab: tab.dataset.tab }
  const dock = node.closest?.('[data-dock]')
  if (dock?.dataset.dock) return { zone: 'dock', dock: dock.dataset.dock }
  const pkg = node.closest?.('[data-package]')
  if (pkg?.dataset.package) return { zone: 'apps', package: pkg.dataset.package }
  const card = node.closest?.('[data-rail-item]')
  if (card) {
    const row = card.closest('[data-rail]')
    return {
      zone: 'rails',
      railIndex: Number(row?.dataset.rail ?? 0),
      railItem: Number(card.dataset.railItem),
    }
  }
  if (node.closest?.('[data-zone="hero"]')) return { zone: 'hero' }
  return null
}

function onClick(event) {
  const hit = casaClickHit(event.target)
  if (!hit) return
  const next = handleCasaClick(shell, hit, model())
  shell = next.shell
  draw()
  perform(next.action)
}

async function boot() {
  await loadStores()
  draw()
  document.addEventListener('keydown', onKey)
  root.addEventListener('click', onClick)
  globalThis.setInterval(draw, 30_000)
}

boot()
