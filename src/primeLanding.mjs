import { absolutePrimeUrl } from './primeApi.mjs'

function parseCard(entity) {
  const titleId = entity?.titleID || entity?.impressionId
  const title = entity?.displayTitle || entity?.title
  if (!titleId || !title) return null
  const cues = entity.entitlementCues ?? {}
  const liveBadge = entity.liveInfo?.timeBadge ?? ''
  return {
    titleId,
    title,
    coverUrl: entity.images?.cover?.url || entity.images?.hero?.url || '',
    year: entity.releaseYear ?? '',
    runtime: entity.runtime ?? '',
    synopsis: entity.synopsis ?? '',
    badge: entity.maturityRatingBadge?.displayText ?? '',
    entitlement: liveBadge || cues.focusMessage?.message || '',
    highValue: cues.highValueMessage?.message ?? '',
    href: absolutePrimeUrl(entity.link?.url ?? ''),
    entityType: entity.entityType ?? '',
  }
}

function parseRow(container) {
  const cards = (container.entities ?? []).map(parseCard).filter(Boolean)
  if (cards.length === 0) return null
  return {
    title: container.title || container.text || '',
    containerType: container.containerType ?? '',
    isContinueWatching: Boolean(container.isContinueWatching),
    cards,
  }
}

/** Converte GetLandingPageOutput em fileiras e cards da tela nativa. */
export function parseLanding(payload) {
  const type = payload?.__type ?? payload
  if (type !== 'atv.wps#GetLandingPageOutput') {
    throw new Error(`landing recusado: recebido ${type}, esperado atv.wps#GetLandingPageOutput`)
  }
  return {
    rows: (payload.containers ?? []).map(parseRow).filter(Boolean),
    pageTitle: payload.pageMetadata?.title ?? '',
    nextToken: payload.pagination?.serviceToken ?? '',
    hasFailed: Boolean(payload.hasFailed),
  }
}
