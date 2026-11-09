/** Configuração de UI e persistência num lugar só. */
export const BRAND = 'OpenFlix'

export const STORAGE_PREFIX = 'life-tv'

export const STORAGE_KEYS = {
  playlists: `${STORAGE_PREFIX}:playlists`,
  favs: `${STORAGE_PREFIX}:favs`,
  resume: `${STORAGE_PREFIX}:resume`,
  history: `${STORAGE_PREFIX}:history`,
  catalogs: `${STORAGE_PREFIX}:catalogs`,
  epg: `${STORAGE_PREFIX}:epg`,
  theme: `${STORAGE_PREFIX}:theme`,
}

/** Conta do cofre local onde o seed guarda a senha inicial. */
export const SEED_ACCOUNT = 'seed'

export const DEFAULT_PLAYLIST_NAME = 'Casa'

export const SECRET_PLACEHOLDER = 'senha guardada localmente'
