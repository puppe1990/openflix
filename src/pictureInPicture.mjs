/**
 * PiP quando o usuário saiu do player com o vídeo ainda tocando.
 * @param {{ screen: string, playing: boolean }} input
 */
export function shouldPictureInPicture({ screen, playing }) {
  if (playing !== true && playing !== false) {
    throw new Error(`playing recusado: recebido ${playing}, esperado boolean`)
  }
  return screen !== 'player' && playing
}

/** Vídeo ativo: não está pausado nem no fim. */
export function isPlayingVideo(video) {
  if (!video) return false
  return video.paused === false && video.ended !== true
}

const PIP_KINDS = new Set(['live', 'movies', 'series', 'youtube'])
const YOUTUBE_PROXY = /^http:\/\/127\.0\.0\.1(?::\d+)?\/video\/[A-Za-z0-9_-]{11}\.(mp4|m3u8)$/

function pipCatalogKind({ catalogKind, selectedItem } = {}) {
  if (PIP_KINDS.has(catalogKind)) return catalogKind
  if (YOUTUBE_PROXY.test(String(selectedItem?.url ?? ''))) return 'youtube'
  return ''
}

/**
 * Volta do PiP para o player cheio com o item que estava tocando.
 * @param {object} shell
 * @param {{ catalogKind: string, selectedItem: object }} snapshot
 */
export function restorePlayerFromPip(shell, snapshot) {
  const selectedItem = snapshot?.selectedItem
  if (!selectedItem) {
    throw new Error(`selectedItem recusado: recebido ${selectedItem}, esperado item do player`)
  }
  const catalogKind = pipCatalogKind(snapshot)
  if (!catalogKind) {
    throw new Error(
      `catalogKind recusado: recebido ${snapshot.catalogKind}, esperado live, movies, series ou youtube`,
    )
  }
  return { ...shell, screen: 'player', catalogKind, selectedItem }
}
