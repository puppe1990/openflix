function textOf(node) {
  if (!node) return ''
  if (typeof node === 'string') return node
  if (node.simpleText) return String(node.simpleText)
  if (node.content && typeof node.content === 'string') return node.content
  if (Array.isArray(node.runs)) return node.runs.map((run) => run.text ?? '').join('')
  return ''
}

function thumbnailOf(node) {
  const thumbs = node?.thumbnails ?? node?.sources ?? []
  if (!Array.isArray(thumbs) || thumbs.length === 0) return ''
  return thumbs[thumbs.length - 1]?.url ?? thumbs[0]?.url ?? ''
}

function cardFromVideo(node) {
  const videoId = node?.videoId
  const title = textOf(node?.title)
  if (!videoId || !title) return null
  return {
    videoId,
    title,
    channel: textOf(node.ownerText) || textOf(node.shortBylineText),
    length: textOf(node.lengthText),
    coverUrl: thumbnailOf(node.thumbnail),
    badge: textOf(node.shortViewCountText),
  }
}

function cardFromLockup(node) {
  if (node?.contentType && node.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO') return null
  const videoId = node?.contentId
  const meta = node?.metadata?.lockupMetadataViewModel
  const title = textOf(meta?.title) || textOf(node?.title)
  if (!videoId || !title) return null
  const image = node.contentImage?.thumbnailViewModel?.image
  return {
    videoId,
    title,
    channel: textOf(meta?.metadata),
    length: '',
    coverUrl: thumbnailOf(image) || thumbnailOf(meta?.image),
    badge: '',
  }
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  const values = Array.isArray(node) ? node : Object.values(node)
  for (const value of values) walk(value, visit)
}

function collectCards(root) {
  const cards = []
  const seen = new Set()
  walk(root, (node) => {
    const card =
      cardFromVideo(node.videoRenderer) ||
      cardFromVideo(node.gridVideoRenderer) ||
      cardFromVideo(node.compactVideoRenderer) ||
      cardFromLockup(node.lockupViewModel)
    if (!card || seen.has(card.videoId)) return
    seen.add(card.videoId)
    cards.push(card)
  })
  return cards
}

function collectShelves(root) {
  const shelves = []
  walk(root, (node) => {
    const shelf = node.richShelfRenderer || node.shelfRenderer
    if (shelf) shelves.push(shelf)
  })
  return shelves
}

/** Browse WEB → fileiras 10-foot (grade vira Início, prateleiras mantêm o título). */
export function parseYoutubeBrowse(payload) {
  const seen = new Set()
  const rows = []
  for (const shelf of collectShelves(payload)) {
    const cards = collectCards(shelf).filter((card) => {
      if (seen.has(card.videoId)) return false
      seen.add(card.videoId)
      return true
    })
    if (!cards.length) continue
    rows.push({ title: textOf(shelf.title) || 'Início', cards })
  }
  const rest = collectCards(payload).filter((card) => !seen.has(card.videoId))
  if (rest.length) rows.unshift({ title: 'Início', cards: rest })
  return rows
}

export { collectCards, textOf }
