/** Catálogo live persiste um dia (Smarters AutoUpdateChannels=no). */
export const CATALOG_TTL_MS = 24 * 60 * 60 * 1000

/** Chave de uma playlist+tipo (+fonte xc|m3u) dentro do bucket. */
export function catalogCacheKey(playlistId, kind, source = '') {
  if (typeof playlistId !== 'string' || playlistId.trim() === '' || typeof kind !== 'string') {
    throw new Error(
      `cache recusado: recebido ${JSON.stringify({ playlistId, kind })}, esperado playlistId e kind`,
    )
  }
  const extra = typeof source === 'string' ? source.trim() : ''
  return extra ? `${playlistId}:${kind}:${extra}` : `${playlistId}:${kind}`
}

/** Lê o catálogo se ainda está dentro do TTL. */
export function readFreshCatalog(
  bucket,
  { playlistId, kind, source = '', now = Date.now(), ttlMs = CATALOG_TTL_MS },
) {
  const all = bucket.read() ?? {}
  const entry = all[catalogCacheKey(playlistId, kind, source)]
  if (!entry?.catalog || !Number.isFinite(entry.savedAt)) return null
  if (now - entry.savedAt > ttlMs) return null
  return entry.catalog
}

/** Grava o catálogo com o horário da captura. */
export function writeCatalogCache(
  bucket,
  { playlistId, kind, catalog, source = '', now = Date.now() },
) {
  const all = { ...(bucket.read() ?? {}) }
  all[catalogCacheKey(playlistId, kind, source)] = { catalog, savedAt: now }
  bucket.write(all)
}
