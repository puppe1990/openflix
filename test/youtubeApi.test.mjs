import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker, fakerYoutubeVideoId } from './factories.mjs'

faker.seed(20261108)

const {
  ANDROID_CLIENT_NAME,
  IOS_CLIENT_NAME,
  IOS_DEVICE_MODEL,
  WEB_CLIENT_NAME,
  WEB_CLIENT_VERSION,
  YOUTUBE_ACCOUNT_MENU,
  YOUTUBE_BROWSE,
  YOUTUBE_GUIDE,
  YOUTUBE_NEXT,
  YOUTUBE_ORIGIN,
  YOUTUBE_PLAYER,
  YOUTUBE_SEARCH,
  assertYoutubeRequest,
  youtubeAndroidBody,
  youtubeClientKindFor,
  youtubeIosBody,
  youtubePlayerBodies,
  youtubeWebBody,
} = await import('../src/youtubeApi.mjs')

beforeEach(() => {
  faker.seed(20261108)
})

test('assertYoutubeRequest aceita só POST Innertube WEB de catálogo e player', () => {
  for (const path of [
    YOUTUBE_BROWSE,
    YOUTUBE_SEARCH,
    YOUTUBE_PLAYER,
    YOUTUBE_NEXT,
    YOUTUBE_GUIDE,
    YOUTUBE_ACCOUNT_MENU,
  ]) {
    assert.doesNotThrow(() => assertYoutubeRequest('POST', path))
  }
})

test('assertYoutubeRequest recusa GET, outro host e log_event', () => {
  assert.throws(
    () => assertYoutubeRequest('GET', YOUTUBE_BROWSE),
    /endpoint do youtube recusado: recebido GET \/youtubei\/v1\/browse, esperado POST \/youtubei\/v1\/(browse|search|player|next|guide|account\/account_menu)/,
  )
  assert.throws(
    () => assertYoutubeRequest('POST', '/youtubei/v1/log_event'),
    /endpoint do youtube recusado: recebido POST \/youtubei\/v1\/log_event/,
  )
  assert.throws(
    () => assertYoutubeRequest('POST', '/youtubei/v1/music/get_search_suggestions'),
    /endpoint do youtube recusado/,
  )
})

test('origem é www.youtube.com e cliente WEB não é WEB_REMIX', () => {
  assert.equal(YOUTUBE_ORIGIN, 'https://www.youtube.com')
  assert.equal(WEB_CLIENT_NAME, 'WEB')
  assert.equal(WEB_CLIENT_VERSION, '2.20261105.05.01')
  assert.notEqual(WEB_CLIENT_NAME, 'WEB_REMIX')
})

test('browse/search/guide usam WEB; /player usa ANDROID', () => {
  assert.equal(youtubeClientKindFor(YOUTUBE_BROWSE), 'web')
  assert.equal(youtubeClientKindFor(YOUTUBE_SEARCH), 'web')
  assert.equal(youtubeClientKindFor(YOUTUBE_GUIDE), 'web')
  assert.equal(youtubeClientKindFor(YOUTUBE_PLAYER), 'android')
})

test('youtubeWebBody e youtubeAndroidBody montam context.client com hl/gl BR', () => {
  const browseId = 'FEwhat_to_watch'
  const web = youtubeWebBody({ browseId })
  assert.equal(web.browseId, browseId)
  assert.equal(web.context.client.clientName, WEB_CLIENT_NAME)
  assert.equal(web.context.client.clientVersion, WEB_CLIENT_VERSION)
  assert.equal(web.context.client.hl, 'pt')
  assert.equal(web.context.client.gl, 'BR')

  const videoId = fakerYoutubeVideoId()
  const android = youtubeAndroidBody({ videoId })
  assert.equal(android.videoId, videoId)
  assert.equal(android.context.client.clientName, ANDROID_CLIENT_NAME)
  assert.equal(android.context.client.clientVersion, '20.10.4')
  assert.equal(android.context.client.androidSdkVersion, 30)
  assert.equal(android.contentCheckOk, true)
  assert.equal(android.racyCheckOk, true)
})

test('youtubeIosBody é o cliente IOS do YouTube, não WEB_REMIX', () => {
  const videoId = fakerYoutubeVideoId()
  const ios = youtubeIosBody({ videoId })
  assert.equal(ios.videoId, videoId)
  assert.equal(ios.context.client.clientName, IOS_CLIENT_NAME)
  assert.equal(ios.context.client.clientName, 'IOS')
  assert.equal(ios.context.client.deviceModel, IOS_DEVICE_MODEL)
  assert.equal(ios.context.client.osName, 'iPhone')
  assert.equal(ios.context.client.hl, 'pt')
  assert.equal(ios.context.client.gl, 'BR')
  assert.equal(ios.contentCheckOk, true)
  assert.notEqual(ios.context.client.clientName, 'WEB_REMIX')
})

test('youtubePlayerBodies tenta ANDROID e cai no IOS', () => {
  const videoId = fakerYoutubeVideoId()
  const bodies = youtubePlayerBodies({ videoId })
  assert.equal(bodies.length, 2)
  assert.equal(bodies[0].context.client.clientName, ANDROID_CLIENT_NAME)
  assert.equal(bodies[1].context.client.clientName, IOS_CLIENT_NAME)
  assert.equal(bodies[0].videoId, videoId)
  assert.equal(bodies[1].videoId, videoId)
})
