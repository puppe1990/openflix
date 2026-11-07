/** Primeira leva da listagem; o resto entra no scroll. */
export const CHANNEL_CARD_PAGE = 48

/** Alterna a listagem de canais entre faixa e grade. */
export function nextChannelLayout(current) {
  return current === 'card' ? 'list' : 'card'
}

/** Rótulo do botão: o modo para o qual o clique vai. */
export function channelLayoutLabel(layout) {
  return layout === 'card' ? 'Lista' : 'Cards'
}

/** Lista e cards pintam só até o limite; o resto entra no scroll. */
export function itemsToPaint(items, _layout, limit = CHANNEL_CARD_PAGE) {
  const list = items ?? []
  const cap = Number.isFinite(limit) ? Math.max(0, limit) : CHANNEL_CARD_PAGE
  return list.slice(0, cap)
}

/** Soma uma página sem passar do total. */
export function growCardLimit(limit, total, page = CHANNEL_CARD_PAGE) {
  const now = Number.isFinite(limit) ? limit : page
  const max = Math.max(0, Number(total) || 0)
  return Math.min(max, now + page)
}

/** Perto do fim de um scroller real; lista colapsada ou sem overflow não cresce. */
export function shouldGrowItems(box, threshold = 240) {
  const client = Number(box?.clientHeight) || 0
  const scroll = Number(box?.scrollHeight) || 0
  const top = Number(box?.scrollTop) || 0
  if (client <= 0 || scroll <= client) return false
  return scroll - top - client <= threshold
}
