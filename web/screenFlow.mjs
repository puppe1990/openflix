import { isScreenChange, spinnerLabel, spinnerRemainingMs } from '../src/screenSpinner.mjs'
import { hydratePrime } from './primeClient.mjs'
import { fillCatalog } from './session.mjs'
import { state } from './state.mjs'
import { hydrateYouTube } from './youtubeClient.mjs'

let token = 0
let waitTimer = 0

function emptySpinner() {
  return { busy: false, label: '', startedAt: 0 }
}

function beginSpinner(next) {
  state.spinner = {
    busy: true,
    label: spinnerLabel(next.screen, next.catalogKind),
    startedAt: Date.now(),
  }
}

function endSpinner() {
  state.spinner = emptySpinner()
}

function sleep(ms) {
  return new Promise((resolve) => {
    clearTimeout(waitTimer)
    waitTimer = setTimeout(resolve, ms)
  })
}

/** Troca de tela com overlay; espera o catálogo quando a destino ainda não tem lista. */
export async function transitionTo(next) {
  if (next === state.shell) return
  const changing = isScreenChange(state.shell, next)
  const mine = ++token
  if (changing && state.shell.screen === 'prime' && next.screen !== 'prime') {
    state.prime.detail = null
  }
  if (changing && state.shell.screen === 'youtube' && next.screen !== 'youtube') {
    state.youtube.detail = null
  }
  state.shell = next
  if (changing) {
    beginSpinner(next)
    state.redraw()
  }
  if (state.shell.screen === 'catalog' && !state.shell.catalog) await fillCatalog()
  if (changing && next.screen === 'prime') await hydratePrime(state.prime.destKey)
  if (changing && next.screen === 'youtube') await hydrateYouTube(state.youtube.destKey)
  if (mine !== token) return
  state.redraw()
  if (!changing) return
  const wait = spinnerRemainingMs(state.spinner.startedAt, Date.now())
  if (wait) await sleep(wait)
  if (mine !== token) return
  endSpinner()
  state.redraw()
}
