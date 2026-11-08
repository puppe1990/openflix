import { collectCards } from './youtubeBrowse.mjs'

/** Busca WEB → uma fileira com o termo. */
export function parseYoutubeSearch(payload, query) {
  const title = String(query ?? '').trim()
  if (!title) {
    throw new Error('busca do youtube recusada: recebido vazio, esperado texto')
  }
  const cards = collectCards(payload)
  if (!cards.length) return []
  return [{ title, cards }]
}
