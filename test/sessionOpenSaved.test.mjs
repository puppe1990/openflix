import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { writeCatalogCache } from '../src/catalogCache.mjs'
import { createFakeXtreamPortal } from '../src/fakeXtreamPortal.mjs'
import {
  faker,
  fakerCategory,
  fakerLiveStream,
  fakerM3uItem,
  fakerM3uPlaylist,
  fakerPassword,
  fakerPlaylistName,
  fakerPortal,
  fakerUsername,
  fakerXtreamLogin,
} from './factories.mjs'

const markup = `<form id="playlistForm">
  <input id="plName" />
  <input id="plM3u" />
  <input id="plPortal" />
  <input id="plUser" />
  <input id="plPass" />
  <textarea id="plCandidates"></textarea>
</form>
<p id="error"></p>`

const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, { url: 'http://localhost/' })
globalThis.document = dom.window.document
globalThis.window = dom.window
globalThis.localStorage = dom.window.localStorage

const { state } = await import('../web/state.mjs')
const { openSavedPlaylist } = await import('../web/session.mjs')
const { catalogsBucket, playlistStore } = await import('../web/stores.mjs')

beforeEach(() => {
  faker.seed(91)
  localStorage.clear()
  catalogsBucket.write({})
  state.redraw = () => {}
  state.client = null
  state.playlistId = ''
  state.featured = null
  state.errorText = ''
  state.guide = { key: '', programs: [] }
})

function itemNames(catalog) {
  return (catalog?.categories ?? []).flatMap((category) =>
    (category.items ?? []).map((item) => item.name),
  )
}

function seedPair({ holdM3u } = {}) {
  const m3uTitle = '123 Go! English (AU) Geo'
  const xcTitle = `${faker.company.name()} Sport`
  const m3uUrl = `${fakerPortal({ protocol: 'https', port: 443 })}/lg.m3u`
  const portal = fakerPortal({ protocol: 'http', port: 8080 })
  const username = fakerUsername()
  const password = fakerPassword()
  const category = fakerCategory({ id: 7, name: faker.commerce.department() })
  const stream = fakerLiveStream({ categoryId: 7, name: xcTitle })
  const xcFetch = createFakeXtreamPortal({
    username,
    password,
    login: fakerXtreamLogin({ username, password, portal }),
    liveCategories: [category],
    liveStreams: [stream],
  })
  let releaseM3u = () => {}
  const m3uGate = holdM3u
    ? new Promise((resolve) => {
        releaseM3u = resolve
      })
    : Promise.resolve()
  const m3uBody = fakerM3uPlaylist([fakerM3uItem({ title: m3uTitle, group: '' })])
  globalThis.fetch = async (url) => {
    const href = String(url)
    if (href === m3uUrl) {
      await m3uGate
      return new Response(m3uBody, { status: 200 })
    }
    return xcFetch(url)
  }
  const m3u = playlistStore.add({
    kind: 'm3u',
    name: fakerPlaylistName(),
    url: m3uUrl,
  })
  const xc = playlistStore.add({
    kind: 'xc',
    name: fakerPlaylistName(),
    portal,
    username,
    password,
  })
  return { m3u, xc, m3uTitle, xcTitle, releaseM3u }
}

test('clicar no chip XC pinta o catálogo dessa playlist, não o da M3U anterior', async () => {
  const { m3u, xc, m3uTitle, xcTitle } = seedPair()
  let painted = null
  state.redraw = () => {
    painted = state.shell.catalog
  }
  await openSavedPlaylist(m3u.id)
  assert.ok(itemNames(state.shell.catalog).includes(m3uTitle))
  await openSavedPlaylist(xc.id)
  assert.equal(state.playlistId, xc.id)
  assert.equal(state.shell.screen, 'catalog')
  assert.ok(itemNames(state.shell.catalog).includes(xcTitle))
  assert.equal(itemNames(state.shell.catalog).includes(m3uTitle), false)
  assert.ok(itemNames(painted).includes(xcTitle))
})

test('catálogo M3U atrasado não sobrescreve o XC depois da troca', async () => {
  const { m3u, xc, m3uTitle, xcTitle, releaseM3u } = seedPair({ holdM3u: true })
  const pending = openSavedPlaylist(m3u.id)
  await new Promise((resolve) => setTimeout(resolve, 20))
  await openSavedPlaylist(xc.id)
  releaseM3u()
  await pending
  assert.equal(state.playlistId, xc.id)
  assert.ok(itemNames(state.shell.catalog).includes(xcTitle))
  assert.equal(itemNames(state.shell.catalog).includes(m3uTitle), false)
})

test('cache live da M3U no id do XC não pinta no chip XC', async () => {
  const { m3u, xc, m3uTitle, xcTitle } = seedPair()
  await openSavedPlaylist(m3u.id)
  writeCatalogCache(catalogsBucket, {
    playlistId: xc.id,
    kind: 'live',
    catalog: state.shell.catalog,
  })
  await openSavedPlaylist(xc.id)
  assert.ok(itemNames(state.shell.catalog).includes(xcTitle))
  assert.equal(itemNames(state.shell.catalog).includes(m3uTitle), false)
})
