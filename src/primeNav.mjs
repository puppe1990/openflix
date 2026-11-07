import { absolutePrimeUrl, PRIME_ORIGIN } from './primeApi.mjs'

/** Destino estático da home; o enrichNav não devolve Início. */
export const PRIME_HOME_DEST = {
  key: 'home:home',
  label: 'Início',
  group: 'Prime Video',
  pageType: 'home',
  pageId: 'home',
  targetId: '',
  url: PRIME_ORIGIN,
}

function destKey(pageType, pageId) {
  return `${pageType}:${pageId}`
}

function nodeToDest(node, group) {
  const pageType = node?.swiftPageType ?? ''
  const pageId = node?.swiftPageId ?? ''
  if (!pageType || !pageId) {
    throw new Error(
      `destino recusado: recebido ${pageType}:${pageId}, esperado swiftPageType e swiftPageId`,
    )
  }
  return {
    key: destKey(pageType, pageId),
    label: node.label ?? pageId,
    group,
    pageType,
    pageId,
    targetId: node.id ?? '',
    url: absolutePrimeUrl(node.url ?? ''),
  }
}

/** Converte EnrichNavOutput no trilho: Início + gêneros + coleções. */
export function parseEnrichNav(payload) {
  const type = payload?.__type ?? payload
  if (type !== 'atv.wps#EnrichNavOutput') {
    throw new Error(`enrichNav recusado: recebido ${type}, esperado atv.wps#EnrichNavOutput`)
  }
  const groups = payload.categoryGroups
  if (!Array.isArray(groups)) {
    throw new Error('enrichNav recusado: recebido sem categoryGroups, esperado lista de grupos')
  }
  const dests = [PRIME_HOME_DEST]
  for (const group of groups) {
    const label = group.label ?? ''
    for (const node of group.subNodes ?? []) dests.push(nodeToDest(node, label))
  }
  return dests
}

/** Acha o destino pela chave `pageType:pageId`. */
export function primeDest(dests, key) {
  const dest = dests.find((item) => item.key === key)
  if (!dest) {
    const keys = dests.map((item) => item.key).join(', ')
    throw new Error(`destino recusado: recebido ${key}, esperado ${keys}`)
  }
  return dest
}
