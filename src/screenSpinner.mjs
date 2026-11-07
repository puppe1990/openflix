export const SPINNER_MIN_MS = 320

const LABELS = {
  'catalog:live': 'Abrindo ao vivo…',
  'catalog:movies': 'Abrindo filmes…',
  'catalog:series': 'Abrindo séries…',
  player: 'Abrindo reprodução…',
  prime: 'Abrindo Prime Video…',
  settings: 'Abrindo ajustes…',
  home: 'Abrindo início…',
}

/** Rótulo pt-BR da transição; catálogo usa o kind. */
export function spinnerLabel(screen, catalogKind) {
  if (screen === 'catalog') return LABELS[`catalog:${catalogKind}`] ?? 'Abrindo catálogo…'
  return LABELS[screen] ?? 'Carregando…'
}

/** Troca de tela 10-foot: screen diferente ou aba do catálogo. */
export function isScreenChange(from, to) {
  if (!from?.screen || !to?.screen) {
    throw new Error(
      `troca recusada: recebido ${JSON.stringify({ from, to })}, esperado shells com screen`,
    )
  }
  if (from.screen !== to.screen) return true
  return from.screen === 'catalog' && from.catalogKind !== to.catalogKind
}

/** Quanto falta para o overlay cumprir o tempo mínimo. */
export function spinnerRemainingMs(startedAt, now, minMs = SPINNER_MIN_MS) {
  if (!Number.isFinite(startedAt)) {
    throw new Error(
      `relógio recusado: recebido startedAt ${JSON.stringify(startedAt)}, esperado número`,
    )
  }
  if (!Number.isFinite(now) || !Number.isFinite(minMs)) {
    throw new Error(
      `relógio recusado: recebido now ${JSON.stringify(now)} minMs ${JSON.stringify(minMs)}, esperado número`,
    )
  }
  return Math.max(0, minMs - (now - startedAt))
}
