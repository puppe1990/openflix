import { CHANNEL_CARD_PAGE } from '../src/channelLayout.mjs'
import { createPrimeFocus } from '../src/primeFocus.mjs'
import { PRIME_CHROME_DESTS, PRIME_HOME_DEST } from '../src/primeNav.mjs'
import { DEFAULT_SETTINGS_TAB } from '../src/settingsTabs.mjs'
import { createTvShell } from '../src/tvShell.mjs'
import { createYoutubeFocus } from '../src/youtubeFocus.mjs'
import { YOUTUBE_CHROME_DESTS, YOUTUBE_HOME_DEST } from '../src/youtubeNav.mjs'

/** Estado vazio da aba Prime Video (catálogo nativo). */
export function emptyPrime() {
  return {
    dests: [...PRIME_CHROME_DESTS],
    destKey: PRIME_HOME_DEST.key,
    rows: [],
    detail: null,
    focus: createPrimeFocus(),
    guest: true,
    pane: { url: null, title: '' },
  }
}

/** Estado vazio da aba YouTube (catálogo Innertube). */
export function emptyYoutube() {
  return {
    dests: [...YOUTUBE_CHROME_DESTS],
    destKey: YOUTUBE_HOME_DEST.key,
    rows: [],
    detail: null,
    focus: createYoutubeFocus(),
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
  youtube: emptyYoutube(),
  settingsTab: DEFAULT_SETTINGS_TAB,
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
