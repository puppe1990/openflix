import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'

faker.seed(20261110)

const {
  isLicenseCapture,
  isPlaybackCapture,
  latestPlaybackPair,
  primePlaybackFromCapture,
  primePlaybackFromCaptures,
} = await import('../src/primePlayback.mjs')

const TITLE_ID = 'amzn1.dv.gti.80ad4d7c-ac82-4a33-9c9a-bf3ce0c0d0de'
const LICENSE_URL = `https://atv-ps.primevideo.com/playback/drm-vod/GetFairPlayLicense?deviceID=Web&deviceTypeID=AOAGZA014O5RE&titleId=${TITLE_ID}&nerid=abc`

beforeEach(() => {
  faker.seed(20261110)
})

function prsCapture(overrides = {}) {
  const envelope = overrides.envelope ?? faker.string.alphanumeric({ length: 64 })
  const handoff = overrides.handoff ?? faker.string.alphanumeric({ length: 48 })
  const hlsUrl = overrides.hlsUrl ?? `https://cdn.${faker.internet.domainName()}/vod/master.m3u8`
  const keyId = overrides.keyId ?? `skd://${faker.string.uuid()}`
  const durationMs = overrides.durationMs ?? 6_449_000
  const urlSetId = 'urlset-1'
  const body = {
    globalParameters: { playbackEnvelope: envelope },
    vodPlaybackUrlsRequest: { device: {} },
  }
  const response = {
    sessionization: { sessionHandoffToken: handoff },
    fairPlayApplicationCertificate: {
      result: { encodedApplicationCertificate: 'MIIE1TCC' },
    },
    vodPlaybackUrls: {
      result: {
        playbackUrls: {
          defaultUrlSetId: urlSetId,
          defaultAudioTrackId: 'pt-br_dialog_0',
          fullTitleDurationMs: durationMs,
          urlSets: [
            { urlSetId: 'fallback', url: 'https://cdn.fallback.test/x.m3u8' },
            { urlSetId: urlSetId, url: hlsUrl, fairplayKeyIds: [keyId] },
          ],
        },
      },
    },
  }
  return {
    kind: 'fetch',
    at: overrides.at ?? 1_000,
    method: 'POST',
    url: `https://atv-ps.primevideo.com/playback/prs/GetVodPlaybackResources?deviceID=Web&titleId=${TITLE_ID}`,
    body: JSON.stringify(body),
    status: 200,
    response: JSON.stringify(response),
  }
}

function licenseCapture(overrides = {}) {
  return {
    kind: 'fetch',
    at: overrides.at ?? 2_000,
    method: 'POST',
    url: overrides.url ?? LICENSE_URL,
    body: JSON.stringify({
      playbackEnvelope: faker.string.alphanumeric({ length: 64 }),
      sessionHandoffToken: faker.string.alphanumeric({ length: 48 }),
      licenseChallenge: 'AAAAAQAAAAA',
    }),
    status: 200,
    response: JSON.stringify({ fairPlayLicense: { license: 'AAAAAQAAAAA' } }),
  }
}

test('reconhece capturas de PRS e de licença FairPlay', () => {
  assert.equal(isPlaybackCapture(prsCapture()), true)
  assert.equal(isPlaybackCapture(licenseCapture()), false)
  assert.equal(isLicenseCapture(licenseCapture()), true)
  assert.equal(isLicenseCapture(prsCapture()), false)
  assert.equal(isPlaybackCapture({ url: 'https://atv-ps.primevideo.com/acm/x' }), false)
  assert.equal(isLicenseCapture({ url: 'https://exemplo.net/GetFairPlayLicense' }), false)
})

test('latestPlaybackPair prefere o PRS mais recente antes da licença', () => {
  const trailer = prsCapture({ at: 1_000, durationMs: 149_000, envelope: 'trailer' })
  const feature = prsCapture({ at: 3_000, durationMs: 6_449_000, envelope: 'feature' })
  const license = licenseCapture({ at: 4_000 })
  const pair = latestPlaybackPair([trailer, license, feature])
  assert.equal(pair.prs, feature)
  assert.equal(pair.license, license)
  assert.equal(latestPlaybackPair([trailer]), null)
})

test('primePlaybackFromCaptures devolve HLS, envelope, handoff, cert e licença', () => {
  const playback = primePlaybackFromCaptures([prsCapture(), licenseCapture()])
  assert.equal(playback.titleId, TITLE_ID)
  assert.equal(playback.live, false)
  assert.equal(playback.durationMs, 6_449_000)
  assert.equal(playback.defaultAudioTrackId, 'pt-br_dialog_0')
  assert.match(playback.hlsUrl, /\/vod\/master\.m3u8$/)
  assert.match(playback.keyId, /^skd:\/\//)
  assert.equal(playback.certBase64, 'MIIE1TCC')
  assert.equal(playback.licenseUrl, LICENSE_URL)
  assert.match(playback.prsUrl, /GetVodPlaybackResources/)
  assert.match(playback.prsBody, /playbackEnvelope/)
  assert.ok(playback.envelope.length > 10)
  assert.ok(playback.handoffToken.length > 10)
})

test('primePlaybackFromCaptures aceita live e não exige duração', () => {
  const capture = prsCapture()
  const request = JSON.parse(capture.body)
  request.livePlaybackUrlsRequest = {}
  const response = JSON.parse(capture.response)
  response.livePlaybackUrls = response.vodPlaybackUrls
  delete response.livePlaybackUrls.result.playbackUrls.fullTitleDurationMs
  delete response.vodPlaybackUrls
  const live = { ...capture, body: JSON.stringify(request), response: JSON.stringify(response) }
  const playback = primePlaybackFromCaptures([live, licenseCapture()])
  assert.equal(playback.live, true)
  assert.equal(playback.durationMs, null)
})

test('primePlaybackFromCaptures aceita canal linear e licença drm-live', () => {
  const capture = prsCapture()
  capture.url = `https://atv-ps.primevideo.com/playback/prs/GetLiveLinearPlaybackResources?deviceID=Web&titleId=${TITLE_ID}`
  const request = JSON.parse(capture.body)
  request.liveLinearPlaybackUrlsRequest = {}
  const response = JSON.parse(capture.response)
  response.liveLinearPlaybackUrls = response.vodPlaybackUrls
  delete response.liveLinearPlaybackUrls.result.playbackUrls.fullTitleDurationMs
  delete response.vodPlaybackUrls
  capture.body = JSON.stringify(request)
  capture.response = JSON.stringify(response)
  const license = licenseCapture({
    url: `https://atv-ps.primevideo.com/playback/drm-live/GetFairPlayLicense?titleId=${TITLE_ID}`,
  })
  const playback = primePlaybackFromCaptures([capture, license])
  assert.equal(playback.live, true)
  assert.equal(playback.durationMs, null)
  assert.match(playback.licenseUrl, /drm-live\/GetFairPlayLicense/)
})

test('recusa captura sem envelope e licença fora do atv-ps', () => {
  const semEnvelope = prsCapture()
  const body = JSON.parse(semEnvelope.body)
  delete body.globalParameters.playbackEnvelope
  semEnvelope.body = JSON.stringify(body)
  assert.throws(
    () => primePlaybackFromCaptures([semEnvelope, licenseCapture()]),
    /playbackEnvelope.*recebido vazio/,
  )
  assert.throws(
    () =>
      primePlaybackFromCapture(
        prsCapture(),
        licenseCapture({ url: 'https://exemplo.net/playback/drm-vod/GetFairPlayLicense' }),
      ),
    /licença do prime recusada: recebido https:\/\/exemplo\.net/,
  )
})

test('recusa captura sem handoff e sem URL de HLS', () => {
  const semHandoff = prsCapture()
  const response = JSON.parse(semHandoff.response)
  delete response.sessionization
  semHandoff.response = JSON.stringify(response)
  assert.throws(
    () => primePlaybackFromCaptures([semHandoff, licenseCapture()]),
    /sessionHandoffToken.*recebido vazio/,
  )
  const semUrl = prsCapture()
  const semUrlResponse = JSON.parse(semUrl.response)
  const urls = semUrlResponse.vodPlaybackUrls.result.playbackUrls
  urls.urlSets = [{ urlSetId: urls.defaultUrlSetId }]
  semUrl.response = JSON.stringify(semUrlResponse)
  assert.throws(
    () => primePlaybackFromCaptures([semUrl, licenseCapture()]),
    /urlSet sem URL do HLS/,
  )
})
