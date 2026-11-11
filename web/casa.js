import {
  callHouse,
  casaClock,
  casaHero,
  casaRails,
  createCasaShell,
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

async function boot() {
  await loadStores()
  draw()
  document.addEventListener('keydown', onKey)
  globalThis.setInterval(draw, 30_000)
}

boot()
