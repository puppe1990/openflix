import { createPlaylistStore } from '../src/addPlaylist.mjs'
import { createFavLockStore } from '../src/favLockStore.mjs'
import { createJsonBucket } from '../src/jsonBucket.mjs'
import { redactPlaylist } from '../src/playlistSecret.mjs'
import { createResumeStore } from '../src/resumeStore.mjs'
import { createSqliteBucket, migrateLocalToSqlite } from '../src/sqliteBucket.mjs'
import { createThemeStore } from '../src/theme.mjs'
import { createWatchHistoryStore } from '../src/watchHistoryStore.mjs'
import { localStore, tauriInvoke } from './bridge.mjs'
import { STORAGE_KEYS } from './config.mjs'

function makeBucket(key) {
  const invoke = tauriInvoke()
  if (invoke) return createSqliteBucket({ invoke, key })
  return createJsonBucket({ storage: localStore(), key })
}

const playlistsBucket = makeBucket(STORAGE_KEYS.playlists)
const favsBucket = makeBucket(STORAGE_KEYS.favs)
const resumeBucket = makeBucket(STORAGE_KEYS.resume)
const historyBucket = makeBucket(STORAGE_KEYS.history)
/** Catálogo live persistido (sqlite no Tauri, memória no preview). */
export const catalogsBucket = makeBucket(STORAGE_KEYS.catalogs)
/** xmltv diário persistido. */
export const epgBucket = makeBucket(STORAGE_KEYS.epg)
/** Claro/escuro do chrome 10-foot. */
export const themeBucket = makeBucket(STORAGE_KEYS.theme)

/** No shell Tauri a senha sai da playlist e vai pro cofre local. */
const secretlessBucket = {
  read() {
    return playlistsBucket.read()
  },
  write(items) {
    return playlistsBucket.write(tauriInvoke() ? items.map(redactPlaylist) : items)
  },
}

/** Playlists salvas; no Tauri a senha sai do registro. */
export const playlistStore = createPlaylistStore({ bucket: secretlessBucket })
/** Favoritos e travas por stream_id, persistidos. */
export const favStore = createFavLockStore({ bucket: favsBucket })
/** Posição de retomada por stream_id, persistida. */
export const resumeStore = createResumeStore({ bucket: resumeBucket })
/** Canais e títulos abertos recentemente, persistidos. */
export const historyStore = createWatchHistoryStore({ bucket: historyBucket })
/** Modo claro/escuro, persistido. */
export const themeStore = createThemeStore({ bucket: themeBucket })

/** No Tauri, migra localStorage → sqlite e hidrata as stores. */
export async function loadStores() {
  const invoke = tauriInvoke()
  if (!invoke) return
  await migrateLocalToSqlite({
    invoke,
    storage: localStore(),
    keys: Object.values(STORAGE_KEYS),
  })
  await Promise.all([
    playlistsBucket.load(),
    favsBucket.load(),
    resumeBucket.load(),
    historyBucket.load(),
    catalogsBucket.load(),
    epgBucket.load(),
    themeBucket.load(),
  ])
  playlistStore.hydrate()
  favStore.hydrate()
  resumeStore.hydrate()
  historyStore.hydrate()
  themeStore.hydrate()
}
