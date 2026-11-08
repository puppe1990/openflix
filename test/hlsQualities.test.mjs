import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import {
  HLS_QUALITY_AUTO,
  hlsQualityLabel,
  parseHlsQualities,
  withAutoQuality,
} from '../src/hlsQualities.mjs'

beforeEach(() => {
  faker.seed(88)
})

function fakerMaster(levels) {
  const lines = ['#EXTM3U', '#EXT-X-INDEPENDENT-SEGMENTS']
  for (const level of levels) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${level.bandwidth},CODECS="mp4a.40.2,avc1.4D401E",RESOLUTION=${level.width}x${level.height},FRAME-RATE=${level.frameRate}`,
    )
    lines.push(level.url)
  }
  return `${lines.join('\n')}\n`
}

test('hlsQualityLabel segue o menu do YouTube: HD e fps só quando importa', () => {
  assert.equal(hlsQualityLabel({ height: 1080, frameRate: 60 }), '1080p60 HD')
  assert.equal(hlsQualityLabel({ height: 720, frameRate: 60 }), '720p60')
  assert.equal(hlsQualityLabel({ height: 480, frameRate: 30 }), '480p')
  assert.equal(hlsQualityLabel({ height: 360, frameRate: 30 }), '360p')
  assert.equal(hlsQualityLabel({ height: 240, frameRate: 30 }), '240p')
  assert.equal(hlsQualityLabel({ height: 144, frameRate: 30 }), '144p')
})

test('parseHlsQualities lê STREAM-INF e ignora I-FRAME', () => {
  const high = `http://127.0.0.1:${faker.internet.port()}/ytg?u=${faker.string.alphanumeric(8)}`
  const low = `http://127.0.0.1:${faker.internet.port()}/ytg?u=${faker.string.alphanumeric(8)}`
  const body = fakerMaster([
    { bandwidth: 269034, width: 256, height: 144, frameRate: 30, url: low },
    { bandwidth: 5552610, width: 1920, height: 1080, frameRate: 60, url: high },
  ])
  const withIframe = `${body}#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=100,RESOLUTION=256x144,URI="https://iframe.example/index.m3u8"\n`
  const qualities = parseHlsQualities(withIframe)
  assert.equal(qualities.length, 2)
  assert.equal(qualities[0].label, '1080p60 HD')
  assert.equal(qualities[0].url, high)
  assert.equal(qualities[0].id, '1080p60')
  assert.equal(qualities[1].label, '144p')
  assert.equal(qualities[1].url, low)
})

test('withAutoQuality põe Automático na frente com a url do master', () => {
  const master = `http://127.0.0.1:${faker.internet.port()}/video/${faker.string.alphanumeric(11)}.m3u8`
  const qualities = parseHlsQualities(
    fakerMaster([
      {
        bandwidth: 962461,
        width: 640,
        height: 360,
        frameRate: 30,
        url: `http://127.0.0.1:${faker.internet.port()}/ytg?u=mid`,
      },
    ]),
  )
  const options = withAutoQuality(qualities, master)
  assert.equal(options[0].id, HLS_QUALITY_AUTO)
  assert.equal(options[0].label, 'Automático')
  assert.equal(options[0].url, master)
  assert.equal(options[1].label, '360p')
})
