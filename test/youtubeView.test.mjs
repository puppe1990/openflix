import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { createTvShell } from '../src/tvShell.mjs'
import { createYoutubeFocus } from '../src/youtubeFocus.mjs'
import { parseYoutubeBrowse } from '../src/youtubeBrowse.mjs'
import { YOUTUBE_CHROME_DESTS } from '../src/youtubeNav.mjs'
import {
  faker,
  fakerYoutubeBrowse,
  fakerYoutubePlayer,
  fakerYoutubeVideoRenderer,
} from './factories.mjs'

faker.seed(20261108)

const dom = new JSDOM('<!doctype html><body><section id="youtube" hidden></section></body>')
globalThis.document = dom.window.document
globalThis.window = dom.window

const { emptyYoutube, state } = await import('../web/state.mjs')
const { handleYoutubeKey, playYoutubeCard, renderYoutube } = await import('../web/youtubeView.mjs')

beforeEach(() => {
  faker.seed(20261108)
  delete globalThis.__TAURI__
  state.redraw = renderYoutube
  state.errorText = ''
  state.shell = { ...createTvShell(), screen: 'youtube' }
  state.youtube = emptyYoutube()
  state.youtube.dests = [...YOUTUBE_CHROME_DESTS]
  state.youtube.destKey = 'FEwhat_to_watch'
  const video = fakerYoutubeVideoRenderer({ title: 'Breakdown', videoId: 'abcdefghijk' })
  state.youtube.rows = parseYoutubeBrowse(fakerYoutubeBrowse({ grid: [video], shelf: [] }))
  state.youtube.focus = createYoutubeFocus()
})

test('tela YouTube lista o trilho chrome e as fileiras', () => {
  renderYoutube()
  const root = document.getElementById('youtube')
  assert.equal(root.hidden, false)
  const dests = [...root.querySelectorAll('[data-youtube-dest]')]
  assert.deepEqual(
    dests.map((node) => node.dataset.youtubeDest),
    ['FEwhat_to_watch', 'FEsubscriptions', 'FEhistory', 'FElibrary'],
  )
  assert.match(root.textContent, /Breakdown/)
  const active = dests.find((node) => node.dataset.youtubeDest === 'FEwhat_to_watch')
  assert.match(active.className, /bg-accent/)
})

test('Enter no card pede o proxy Tauri; sem shell publica o erro', async () => {
  renderYoutube()
  state.youtube.focus = { zone: 'rows', destIndex: 0, rowIndex: 0, cardIndex: 0 }
  assert.equal(handleYoutubeKey('Enter'), true)
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.match(state.errorText, /youtube recusou: recebido preview web, esperado app Tauri/)
})

test('catálogo vazio pede login em vez de carregar para sempre', () => {
  state.youtube.rows = []
  state.errorText = ''
  renderYoutube()
  const text = document.getElementById('youtube').textContent
  assert.match(text, /vem vazio sem sessão/)
  assert.doesNotMatch(text, /Carregando/)
  assert.doesNotMatch(text, /Abra o app Tauri/)
})

test('catálogo vazio com erro HTTP não manda abrir o app Tauri', () => {
  state.youtube.rows = []
  state.errorText = 'youtube recusou: recebido HTTP 400 Bad Request, esperado 2xx'
  renderYoutube()
  const text = document.getElementById('youtube').textContent
  assert.match(text, /Não deu para carregar o catálogo/)
  assert.doesNotMatch(text, /Abra o app Tauri/)
  assert.doesNotMatch(text, /em Ajustes/)
})

test('cabeçalho do YouTube não cobre o trilho com jargão Innertube', () => {
  renderYoutube()
  const text = document.getElementById('youtube').textContent
  assert.match(text, /Entrar no YouTube/)
  assert.doesNotMatch(text, /Innertube/)
  assert.doesNotMatch(text, /quando terminar/)
})

test('Assistir no YouTube abre o player com catalogKind youtube', async () => {
  const card = state.youtube.rows[0].cards[0]
  const googlevideo = `https://rr1---sn-host.googlevideo.com/videoplayback?id=${card.videoId}&itag=18`
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command) => {
        if (command === 'youtube_proxy_base') return 'http://127.0.0.1:43111'
        if (command === 'youtube_request') {
          return JSON.stringify(fakerYoutubePlayer({ videoId: card.videoId, googlevideo }))
        }
        throw new Error(command)
      },
    },
  }
  await playYoutubeCard(card)
  assert.equal(state.errorText, '')
  assert.equal(state.shell.screen, 'player')
  assert.equal(state.shell.catalogKind, 'youtube')
  assert.equal(state.shell.selectedItem.id, card.videoId)
  assert.equal(state.shell.selectedItem.url, `http://127.0.0.1:43111/video/${card.videoId}.mp4`)
})

test('Escape no detalhe fecha o overlay', () => {
  state.youtube.detail = state.youtube.rows[0].cards[0]
  renderYoutube()
  assert.ok(document.getElementById('youtubeDetail'))
  assert.equal(handleYoutubeKey('Escape'), true)
  assert.equal(state.youtube.detail, null)
  assert.equal(document.getElementById('youtubeDetail'), null)
})
