import { pickBootPlaylist } from '../src/bootPlaylist.mjs'
import { discoverPortal } from '../src/discoverPortal.mjs'
import { createDemoFetch, DEMO_PLAYLIST } from '../src/demoPortal.mjs'
import { restorePlaylist } from '../src/playlistSecret.mjs'
import { seedM3uPlaylists, settingsFormValues } from '../src/seedLists.mjs'
import { bindCatalog, createTvShell, focusHome, openHomeTile } from '../src/tvShell.mjs'
import { createM3uClient } from '../src/m3uClient.mjs'
import { createXtreamClient } from '../src/xtreamClient.mjs'
import { DEFAULT_PLAYLIST_NAME, SECRET_PLACEHOLDER, SEED_ACCOUNT } from './config.mjs'
import { byId } from './dom.mjs'
import { readSecret, readSeed, saveSecret, webFetch } from './bridge.mjs'
import { clearError, setError, state } from './state.mjs'
import { readFreshCatalog, writeCatalogCache } from '../src/catalogCache.mjs'
import { readFreshGuide, writeGuideCache } from '../src/epgGuideCache.mjs'
import { indexProgramsByChannel } from '../src/xmltvNowNext.mjs'
import { catalogsBucket, epgBucket, playlistStore } from './stores.mjs'

/** Cliente Xtream apontado para o portal fake do demo. */
export function demoClient() {
  return createXtreamClient({ playlist: DEMO_PLAYLIST, fetch: createDemoFetch() })
}

/** Busca o catálogo do tipo atual no cliente. */
export function catalogFor(kind) {
  if (kind === 'live') return state.client.liveCatalog()
  if (kind === 'movies') return state.client.vodCatalog()
  if (kind === 'series') return state.client.seriesCatalog()
  throw new Error(`catálogo recusado: recebido ${kind}, esperado live, movies ou series`)
}

/** URL de reprodução do item selecionado. */
export function playUrl() {
  const { shell, client, series } = state
  const item = shell.selectedItem
  if (!item) return ''
  if (item.url) return item.url
  if (shell.catalogKind === 'live') return client.livePlayUrl(item.id)
  if (shell.catalogKind === 'movies') return client.moviePlayUrl(item.id, item.extension)
  if (shell.catalogKind === 'series' && series.key === String(item.id)) return series.url
  return ''
}

/** Portais digitados + os das playlists salvas. */
export function candidatesOf() {
  const typed = (byId('plCandidates')?.value ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const saved = playlistStore.list().map((item) => item.portal)
  return [...typed, ...saved].filter(Boolean)
}

async function rotatePortal() {
  const saved = playlistStore.list().find((item) => item.kind === 'xc')
  if (!saved) return null
  const password = saved.password ?? (await readSecret(saved.id))
  if (!password) return null
  const found = await discoverPortal({
    candidates: candidatesOf(),
    username: saved.username,
    password,
    fetch: webFetch(),
  })
  if (!found.portal) return null
  state.client = createXtreamClient({
    playlist: restorePlaylist({ ...saved, portal: found.portal }, password),
    fetch: webFetch(),
  })
  return found.portal
}

/** Repete a chamada uma vez após trocar de portal. */
export async function withRotation(run) {
  try {
    return await run()
  } catch (error) {
    const rotated = await rotatePortal()
    if (!rotated) throw error
    setError(`Portal trocado para ${rotated}`)
    return run()
  }
}

/** Guarda o primeiro item do catálogo como destaque e enriquece filmes. */
export function featureFirst(kind, catalog) {
  const item = catalog?.categories?.[0]?.items?.[0]
  if (!item) return
  state.featured = { kind, name: item.name, id: item.id, icon: item.icon ?? '' }
  if (kind !== 'movies') return
  withRotation(() => state.client.vodInfo(item.id))
    .then((info) => {
      state.featured = { ...state.featured, ...info, name: info.title || item.name }
      state.redraw()
    })
    .catch(() => {})
}

let catalogFill = 0

function catalogFillIsStale(mine, playlistId, client, kind) {
  return (
    mine !== catalogFill ||
    state.playlistId !== playlistId ||
    state.client !== client ||
    state.shell.catalogKind !== kind
  )
}

function bindFreshCatalog(kind, catalog) {
  featureFirst(kind, catalog)
  state.shell = bindCatalog(state.shell, catalog)
}

/** Carrega o catálogo com rotação de portal. Live fresco sai do sqlite. */
export async function fillCatalog() {
  const mine = ++catalogFill
  const playlistId = state.playlistId
  const client = state.client
  const kind = state.shell.catalogKind
  const source = playlistStore.list().find((item) => item.id === playlistId)?.kind ?? ''
  try {
    clearError()
    const cached =
      kind === 'live' && playlistId
        ? readFreshCatalog(catalogsBucket, { playlistId, kind, source })
        : null
    if (cached) {
      if (catalogFillIsStale(mine, playlistId, client, kind)) return
      bindFreshCatalog(kind, cached)
      return
    }
    const catalog = await withRotation(() => catalogFor(kind))
    if (catalogFillIsStale(mine, playlistId, client, kind)) return
    if (kind === 'live' && playlistId) {
      writeCatalogCache(catalogsBucket, { playlistId, kind, source, catalog })
    }
    bindFreshCatalog(kind, catalog)
  } catch (error) {
    if (catalogFillIsStale(mine, playlistId, client, kind)) return
    setError(error.message)
  }
}

function setGuide(playlistId, programs) {
  state.guide = {
    key: playlistId,
    programs,
    byChannel: indexProgramsByChannel(programs),
  }
}

/** Carrega o xmltv do dia (cache sqlite) para a listagem ao vivo. */
export async function fillGuide() {
  const playlistId = state.playlistId
  if (!playlistId || typeof state.client?.epg !== 'function') return
  if (state.guide.key === playlistId) return
  const cached = readFreshGuide(epgBucket, { playlistId })
  setGuide(playlistId, cached ?? [])
  if (cached) return
  try {
    const programs = await withRotation(() => state.client.epg())
    writeGuideCache(epgBucket, { playlistId, programs })
    setGuide(playlistId, programs)
    state.redraw()
  } catch {
    setGuide(playlistId, [])
  }
}

/** Entra no modo demo sem rede. */
export function startDemo() {
  state.client = demoClient()
  clearError()
  state.shell = createTvShell()
  state.redraw()
  state.client
    .vodCatalog()
    .then((catalog) => {
      featureFirst('movies', catalog)
      state.redraw()
    })
    .catch(() => {})
}

function activatePlaylist(client, playlist) {
  catalogFill += 1
  state.client = client
  state.playlistId = playlist?.id ?? ''
  state.shell = createTvShell()
  state.guide = { key: '', programs: [] }
  return hydrateSettingsForm(playlist)
}

function applySettingsValues(values) {
  const name = byId('plName')
  const portal = byId('plPortal')
  const user = byId('plUser')
  const pass = byId('plPass')
  const m3u = byId('plM3u')
  const candidates = byId('plCandidates')
  if (name) name.value = values.name
  if (portal) portal.value = values.portal
  if (user) user.value = values.username
  if (m3u) m3u.value = values.m3u
  if (candidates) candidates.value = values.candidates
  if (pass && values.username) pass.placeholder = SECRET_PLACEHOLDER
}

/** Valida, guarda e ativa a playlist do formulário. */
export async function savePlaylist(event) {
  event.preventDefault()
  try {
    const playlist = playlistStore.add({
      kind: 'xc',
      name: byId('plName').value,
      portal: byId('plPortal').value,
      username: byId('plUser').value,
      password: byId('plPass').value,
    })
    const stored = await saveSecret(playlist.id, playlist.password)
    await activatePlaylist(createXtreamClient({ playlist, fetch: webFetch() }), playlist)
    state.errorText = stored ? '' : 'Senha não foi salva: será pedida a cada abertura.'
    state.redraw()
  } catch (error) {
    setError(error.message)
  }
}

/** Guarda URL M3U própria e ativa o catálogo ao vivo. */
export async function saveM3uPlaylist(event) {
  event.preventDefault()
  try {
    const playlist = playlistStore.add({
      kind: 'm3u',
      name: byId('plName').value || DEFAULT_PLAYLIST_NAME,
      url: byId('plM3u').value,
    })
    await activatePlaylist(createM3uClient({ playlist, fetch: webFetch() }), playlist)
    clearError()
    state.redraw()
  } catch (error) {
    setError(error.message)
  }
}

function explainFailure(attempts) {
  const first = attempts.find((item) => item.error)
  const reason = first ? `${first.portal}: ${first.error}` : 'sem resposta'
  return `Nenhum portal aceitou (${attempts.length} tentativas). ${reason}`
}

/** Testa os portais candidatos e preenche o encontrado. */
export async function discover() {
  const typed = byId('plCandidates')
    .value.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const saved = playlistStore.list().map((item) => item.portal)
  try {
    const found = await discoverPortal({
      candidates: typed.length ? typed : saved,
      username: byId('plUser').value,
      password: byId('plPass').value,
      fetch: webFetch(),
    })
    if (!found.portal) {
      setError(explainFailure(found.attempts))
      return
    }
    byId('plPortal').value = found.portal
    setError(`Portal encontrado: ${found.portal}`)
  } catch (error) {
    setError(error.message)
  }
}

/** Preenche o formulário com a playlist e o seed (portal/usuário/M3U). */
export async function hydrateSettingsForm(playlist) {
  applySettingsValues(settingsFormValues({ playlist, seed: await readSeed() }))
}

function sameXc(item, seed) {
  return item.kind === 'xc' && item.username === seed.username && item.portal === seed.portal
}

function publishRefusal(error) {
  if (!error) return
  setError(`${error.message}. Confira usuário e senha em Ajustes ou cole uma lista M3U.`)
}

function seedDraft(seed, password) {
  return {
    kind: 'xc',
    name: seed.name ?? DEFAULT_PLAYLIST_NAME,
    portal: seed.portal,
    username: seed.username,
    password,
  }
}

async function activatePicked(picked) {
  if (picked.kind === 'm3u') {
    await activatePlaylist(
      createM3uClient({ playlist: picked.playlist, fetch: webFetch() }),
      picked.playlist,
    )
    state.shell = openHomeTile(focusHome(state.shell, 'live'))
    await fillCatalog()
    state.redraw()
    return true
  }
  if (picked.kind !== 'xc') {
    publishRefusal(picked.error)
    await hydrateSettingsForm(picked.playlist)
    return false
  }
  await activatePlaylist(picked.client, picked.playlist)
  state.redraw()
  return true
}

/** Importa as M3U do seed e ativa a primeira. */
export async function bootSeedLists() {
  const lists = seedM3uPlaylists(await readSeed())
  if (lists.length === 0) return false
  const have = new Set(
    playlistStore
      .list()
      .filter((item) => item.kind === 'm3u')
      .map((item) => item.url),
  )
  for (const item of lists) {
    if (!have.has(item.url)) playlistStore.add(item)
  }
  return activatePicked(
    await pickBootPlaylist(playlistStore.list(), { fetch: webFetch(), readSecret }),
  )
}

/** Troca a playlist guardada e abre o ao vivo. */
export async function openSavedPlaylist(id) {
  const playlist = playlistStore.list().find((item) => item.id === id)
  if (!playlist) return
  if (playlist.kind === 'm3u') {
    await activatePlaylist(createM3uClient({ playlist, fetch: webFetch() }), playlist)
  } else if (playlist.kind === 'xc') {
    const ok = await activatePicked(
      await pickBootPlaylist([playlist], { fetch: webFetch(), readSecret }),
    )
    if (!ok) return
  } else return
  state.shell = openHomeTile(focusHome(createTvShell(), 'live'))
  await fillCatalog()
  state.redraw()
}

async function rememberSeed(draft, client, password) {
  const playlist = playlistStore.add(draft)
  await saveSecret(playlist.id, password)
  clearError()
  await activatePlaylist(client, playlist)
  state.redraw()
  return true
}

/** Cria a playlist a partir do seed local, se o portal aceitar a conta. */
export async function bootSeed() {
  const seed = await readSeed()
  if (!seed || !seed.username) return false
  const password = await readSecret(SEED_ACCOUNT)
  if (!password) return false
  if (playlistStore.list().some((item) => sameXc(item, seed))) return false
  const draft = seedDraft(seed, password)
  const picked = await pickBootPlaylist([draft], { fetch: webFetch() })
  if (picked.kind !== 'xc') {
    publishRefusal(picked.error)
    await hydrateSettingsForm()
    return false
  }
  return rememberSeed(draft, picked.client, password)
}

/** Entra no primeiro XC que o portal aceita, ou na M3U salva. */
export async function bootSaved() {
  return activatePicked(
    await pickBootPlaylist(playlistStore.list(), { fetch: webFetch(), readSecret }),
  )
}
