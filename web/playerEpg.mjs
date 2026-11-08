import { minutesBetween } from '../src/epgWindow.mjs'
import { epgClock, epgProgress } from '../src/epgProgress.mjs'
import { ghostClass } from '../src/tvSkin.mjs'
import { byId, el } from './dom.mjs'
import { withRotation } from './session.mjs'
import { state } from './state.mjs'

/** Resolve a URL do primeiro episódio da série. */
export function ensureSeriesUrl(item) {
  const key = String(item.id)
  if (state.series.key === key) return
  state.series = { key, url: '' }
  withRotation(() => state.client.seriesEpisodes(item.id))
    .then((episodes) => {
      const first = episodes[0]
      state.series = {
        key,
        url: first ? state.client.seriesPlayUrl(first.id, first.extension) : '',
      }
    })
    .catch((error) => {
      state.errorText = error.message
    })
    .finally(() => state.redraw())
}

/** Carrega o EPG curto do canal, uma vez por item. */
export function ensureEpg(item) {
  const key = String(item.id)
  if (state.epg.key === key) return
  state.epg = { key, listings: [] }
  withRotation(() => state.client.shortEpg(item.id))
    .then((listings) => {
      state.epg = { key, listings }
    })
    .catch(() => {})
    .finally(() => state.redraw())
}

function openCatchUp(item, listing) {
  try {
    const url = state.client.catchUpUrl({
      streamId: item.id,
      durationMinutes: minutesBetween(listing.start, listing.stop),
      start: listing.start,
    })
    const video = byId('player').querySelector('video')
    if (!video) return
    video.src = url
    video.play().catch(() => {})
  } catch (error) {
    state.errorText = error.message
    state.redraw()
  }
}

function listingRow(item, listing) {
  const row = el('li', 'rounded-lg bg-well p-3')
  const head = el('div', 'flex items-center justify-between gap-2')
  head.append(el('span', 'truncate font-display text-sm font-bold text-ink', listing.title))
  head.append(
    el('span', 'shrink-0 font-sans text-[10px] font-bold text-mute', epgClock(listing.start)),
  )
  row.append(head)
  const track = el('div', 'mt-2 h-1 overflow-hidden rounded-full bg-panel')
  const fill = el('div', 'h-full bg-accent')
  fill.style.width = `${Math.round(epgProgress(listing) * 100)}%`
  track.append(fill)
  row.append(track)
  if (listing.hasArchive) {
    const button = el('button', `${ghostClass()} mt-2`, 'Assistir do início')
    button.type = 'button'
    button.addEventListener('click', () => openCatchUp(item, listing))
    row.append(button)
  }
  return row
}

/** Lista o EPG com atalho de catch-up quando há archive. */
export function epgBlock(item) {
  const list = el('ul', 'mt-3 list-none space-y-2 p-0')
  for (const listing of state.epg.listings.slice(0, 6)) {
    list.append(listingRow(item, listing))
  }
  return list
}
