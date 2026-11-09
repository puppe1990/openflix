import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  faker,
  fakerYoutubeBrowse,
  fakerYoutubePlayer,
  fakerYoutubeVideoId,
  fakerYoutubeVideoRenderer,
} from './factories.mjs'
import { YOUTUBE_BROWSE, YOUTUBE_PLAYER, youtubeWebBody } from '../src/youtubeApi.mjs'
import { YOUTUBE_CHROME_DESTS } from '../src/youtubeNav.mjs'

faker.seed(20261108)

const { emptyYoutube, state } = await import('../web/state.mjs')
const {
  formatYoutubeError,
  hydrateYouTube,
  loadYoutubePlayback,
  onYoutubeSessionCaptured,
  wireYoutubeSessionListener,
  youtubeRequest,
} = await import('../web/youtubeClient.mjs')

beforeEach(() => {
  faker.seed(20261108)
  delete globalThis.__TAURI__
  state.errorText = ''
  state.youtube = emptyYoutube()
  state.redraw = () => {}
})

test('formatYoutubeError não duplica o prefixo', () => {
  assert.equal(
    formatYoutubeError(new Error('youtube recusou: recebido preview web, esperado app Tauri')),
    'youtube recusou: recebido preview web, esperado app Tauri',
  )
  assert.equal(formatYoutubeError(new Error('HTTP 400')), 'youtube recusou: HTTP 400')
})

test('youtubeRequest recusa preview sem Tauri', async () => {
  await assert.rejects(
    () => youtubeRequest(YOUTUBE_BROWSE, youtubeWebBody({ browseId: 'FEwhat_to_watch' })),
    /youtube recusou: recebido preview web, esperado app Tauri/,
  )
})

test('hydrateYouTube no preview guarda o trilho chrome e publica o erro', async () => {
  await hydrateYouTube()
  assert.deepEqual(
    state.youtube.dests.map((dest) => dest.key),
    YOUTUBE_CHROME_DESTS.map((dest) => dest.key),
  )
  assert.equal(state.youtube.destKey, 'FEwhat_to_watch')
  assert.match(state.errorText, /youtube recusou: recebido preview web, esperado app Tauri/)
})

test('hydrateYouTube recusa FEtrending e cai no Início', async () => {
  const video = fakerYoutubeVideoRenderer({ title: 'Breakdown', videoId: 'abcdefghijk' })
  const browseIds = []
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        assert.equal(command, 'youtube_request')
        browseIds.push(JSON.parse(args.body).browseId)
        return JSON.stringify(fakerYoutubeBrowse({ grid: [video], shelf: [] }))
      },
    },
  }
  await hydrateYouTube('FEtrending')
  assert.deepEqual(browseIds, ['FEwhat_to_watch'])
  assert.equal(state.youtube.destKey, 'FEwhat_to_watch')
  assert.equal(state.errorText, '')
})

test('hydrateYouTube com Tauri preenche as fileiras do browse', async () => {
  const video = fakerYoutubeVideoRenderer({ title: 'Breakdown', videoId: 'abcdefghijk' })
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        assert.equal(command, 'youtube_request')
        assert.equal(args.path, YOUTUBE_BROWSE)
        const body = JSON.parse(args.body)
        assert.equal(body.browseId, 'FEwhat_to_watch')
        assert.equal(body.context.client.clientName, 'WEB')
        return JSON.stringify(fakerYoutubeBrowse({ grid: [video], shelf: [] }))
      },
    },
  }
  await hydrateYouTube('FEwhat_to_watch')
  assert.equal(state.errorText, '')
  assert.equal(state.youtube.rows[0].cards[0].title, 'Breakdown')
})

test('loadYoutubePlayback escolhe HLS na live sem itag 18', async () => {
  const videoId = fakerYoutubeVideoId()
  const hlsManifestUrl = `https://manifest.googlevideo.com/api/manifest/hls_variant/${videoId}/file/index.m3u8`
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        assert.equal(command, 'youtube_request')
        assert.equal(args.path, YOUTUBE_PLAYER)
        const body = JSON.parse(args.body)
        assert.equal(body.videoId, videoId)
        assert.equal(body.context.client.clientName, 'ANDROID')
        return JSON.stringify(
          fakerYoutubePlayer({ videoId, url: '', hlsManifestUrl, title: 'AO VIVO' }),
        )
      },
    },
  }
  const playback = await loadYoutubePlayback(videoId)
  assert.equal(playback.kind, 'hls')
  assert.equal(playback.url, hlsManifestUrl)
})

test('loadYoutubePlayback cai no IOS quando ANDROID pede LOGIN_REQUIRED', async () => {
  const videoId = fakerYoutubeVideoId()
  const googlevideo = `https://rr1---sn-host.googlevideo.com/videoplayback?id=${videoId}&itag=18`
  const clients = []
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        assert.equal(command, 'youtube_request')
        assert.equal(args.path, YOUTUBE_PLAYER)
        const body = JSON.parse(args.body)
        clients.push(body.context.client.clientName)
        if (body.context.client.clientName === 'ANDROID') {
          return JSON.stringify(
            fakerYoutubePlayer({
              videoId,
              status: 'LOGIN_REQUIRED',
              reason: 'Faça login para confirmar que você não é um bot',
            }),
          )
        }
        return JSON.stringify(fakerYoutubePlayer({ videoId, googlevideo }))
      },
    },
  }
  const playback = await loadYoutubePlayback(videoId)
  assert.deepEqual(clients, ['ANDROID', 'IOS'])
  assert.equal(playback.kind, 'progressive')
  assert.equal(playback.url, googlevideo)
})

test('loadYoutubePlayback cai no IOS HLS quando ANDROID pede LOGIN_REQUIRED na live', async () => {
  const videoId = fakerYoutubeVideoId()
  const hlsManifestUrl = `https://manifest.googlevideo.com/api/manifest/hls_variant/${videoId}/file/index.m3u8`
  const clients = []
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        assert.equal(command, 'youtube_request')
        assert.equal(args.path, YOUTUBE_PLAYER)
        const body = JSON.parse(args.body)
        clients.push(body.context.client.clientName)
        if (body.context.client.clientName === 'ANDROID') {
          return JSON.stringify(
            fakerYoutubePlayer({
              videoId,
              status: 'LOGIN_REQUIRED',
              reason: 'Faça login para confirmar que você não é um bot',
            }),
          )
        }
        return JSON.stringify(
          fakerYoutubePlayer({ videoId, url: '', hlsManifestUrl, title: 'AO VIVO' }),
        )
      },
    },
  }
  const playback = await loadYoutubePlayback(videoId)
  assert.deepEqual(clients, ['ANDROID', 'IOS'])
  assert.equal(playback.kind, 'hls')
  assert.equal(playback.url, hlsManifestUrl)
})

test('loadYoutubePlayback cai no WEB quando ANDROID e IOS pedem LOGIN_REQUIRED', async () => {
  const videoId = fakerYoutubeVideoId()
  const googlevideo = `https://rr1---sn-host.googlevideo.com/videoplayback?id=${videoId}&itag=18`
  const clients = []
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        assert.equal(command, 'youtube_request')
        assert.equal(args.path, YOUTUBE_PLAYER)
        const body = JSON.parse(args.body)
        clients.push(body.context.client.clientName)
        if (body.context.client.clientName !== 'WEB') {
          return JSON.stringify(
            fakerYoutubePlayer({
              videoId,
              status: 'LOGIN_REQUIRED',
              reason: 'Faça login para confirmar que você não é um bot',
            }),
          )
        }
        assert.equal(body.contentCheckOk, true)
        return JSON.stringify(fakerYoutubePlayer({ videoId, googlevideo }))
      },
    },
  }
  const playback = await loadYoutubePlayback(videoId)
  assert.deepEqual(clients, ['ANDROID', 'IOS', 'WEB'])
  assert.equal(playback.kind, 'progressive')
  assert.equal(playback.url, googlevideo)
})

test('loadYoutubePlayback cai no WEB HLS quando ANDROID e IOS pedem LOGIN_REQUIRED na live', async () => {
  const videoId = fakerYoutubeVideoId()
  const hlsManifestUrl = `https://manifest.googlevideo.com/api/manifest/hls_variant/${videoId}/file/index.m3u8`
  const clients = []
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command, args) => {
        assert.equal(command, 'youtube_request')
        assert.equal(args.path, YOUTUBE_PLAYER)
        const body = JSON.parse(args.body)
        clients.push(body.context.client.clientName)
        if (body.context.client.clientName !== 'WEB') {
          return JSON.stringify(
            fakerYoutubePlayer({
              videoId,
              status: 'LOGIN_REQUIRED',
              reason: 'Faça login para confirmar que você não é um bot',
            }),
          )
        }
        return JSON.stringify(
          fakerYoutubePlayer({ videoId, url: '', hlsManifestUrl, title: 'AO VIVO' }),
        )
      },
    },
  }
  const playback = await loadYoutubePlayback(videoId)
  assert.deepEqual(clients, ['ANDROID', 'IOS', 'WEB'])
  assert.equal(playback.kind, 'hls')
  assert.equal(playback.url, hlsManifestUrl)
})

test('onYoutubeSessionCaptured recarrega o catálogo só na tela YouTube', async () => {
  const video = fakerYoutubeVideoRenderer({ title: 'NFL Madrid', videoId: 'abcdefghijk' })
  let calls = 0
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command) => {
        assert.equal(command, 'youtube_request')
        calls += 1
        return JSON.stringify(fakerYoutubeBrowse({ grid: [video], shelf: [] }))
      },
    },
  }
  state.shell.screen = 'home'
  await onYoutubeSessionCaptured()
  assert.equal(calls, 0)
  state.shell.screen = 'youtube'
  await onYoutubeSessionCaptured()
  assert.equal(calls, 1)
  assert.equal(state.youtube.rows[0].cards[0].title, 'NFL Madrid')
})

test('wireYoutubeSessionListener escuta youtube-session e recarrega', async () => {
  const video = fakerYoutubeVideoRenderer({ title: 'Inscrições', videoId: 'abcdefghijk' })
  let eventName = ''
  let listener
  globalThis.__TAURI__ = {
    core: {
      invoke: async () => JSON.stringify(fakerYoutubeBrowse({ grid: [video], shelf: [] })),
    },
  }
  state.shell.screen = 'youtube'
  assert.equal(
    wireYoutubeSessionListener(async (name, fn) => {
      eventName = name
      listener = fn
    }),
    true,
  )
  assert.equal(eventName, 'youtube-session')
  await listener()
  assert.equal(state.youtube.rows[0].cards[0].title, 'Inscrições')
  assert.equal(wireYoutubeSessionListener(null), false)
})
