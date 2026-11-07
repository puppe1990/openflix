import { CHANNEL_CARD_PAGE } from '../src/channelLayout.mjs'
import { createPrimeFocus } from '../src/primeFocus.mjs'
import { PRIME_HOME_DEST } from '../src/primeNav.mjs'
import { createTvShell } from '../src/tvShell.mjs'

/** Estado vazio da aba Prime Video (catálogo nativo). */
export function emptyPrime() {
  return {
    dests: [PRIME_HOME_DEST],
    destKey: PRIME_HOME_DEST.key,
    rows: [],
    detail: null,
    focus: createPrimeFocus(),
    guest: true,
  }
}

/** Estado único da tela; views leem, sessão e wiring escrevem. */
export const state = {
  shell: createTvShell(),
  client: null,
  errorText: '',
  series: { key: '', url: '' },
  featured: null,
  playlistId: '',
  epg: { key: '', listings: [] },
  guide: { key: '', programs: [] },
  channelLayout: 'list',
  itemLimit: CHANNEL_CARD_PAGE,
  spinner: { busy: false, label: '', startedAt: 0 },
  prime: emptyPrime(),
  redraw: () => {},
}

/** Registra a função de redesenho (renderAll). */
export function setRedraw(redraw) {
  state.redraw = redraw
}

/** Publica a mensagem de erro e redesenha. */
export function setError(text) {
  state.errorText = text
  state.redraw()
}

/** Limpa a mensagem de erro sem redesenhar. */
export function clearError() {
  state.errorText = ''
}
