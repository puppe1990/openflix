/** Destino estático da home WEB (`FEwhat_to_watch`). */
export const YOUTUBE_HOME_DEST = {
  key: 'FEwhat_to_watch',
  label: 'Início',
  group: 'YouTube',
}

export const YOUTUBE_CHROME_DESTS = [
  YOUTUBE_HOME_DEST,
  { key: 'FEsubscriptions', label: 'Inscrições', group: 'YouTube' },
  { key: 'FEhistory', label: 'Histórico', group: 'YouTube' },
  { key: 'FEtrending', label: 'Em alta', group: 'YouTube' },
]

const DEST_LABEL = YOUTUBE_CHROME_DESTS.map((dest) => dest.key)
  .join(', ')
  .replace(/, ([^,]+)$/, ' ou $1')

/** Acha o destino pelo browseId do trilho. */
export function youtubeDest(dests, key) {
  const found = dests.find((dest) => dest.key === key)
  if (!found) {
    throw new Error(`destino do youtube recusado: recebido ${key}, esperado ${DEST_LABEL}`)
  }
  return found
}
