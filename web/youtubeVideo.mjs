import { hydrateYouTube } from './youtubeClient.mjs'

/** Nome do evento que leva a interface para a aba YouTube. */
export const YOUTUBE_SCREEN_EVENT = 'openflix:youtube'

/** Troca o destino do catálogo nativo e recarrega as fileiras. */
export function openYoutubeDest(key) {
  return hydrateYouTube(key)
}

/** Troca para a aba YouTube, que carrega o catálogo pelo Innertube. */
export function openYoutube() {
  const view = document.defaultView ?? globalThis
  document.dispatchEvent(new view.CustomEvent(YOUTUBE_SCREEN_EVENT))
}
