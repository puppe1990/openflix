import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { faker } from './factories.mjs'

const dom = new JSDOM('<!doctype html><body></body>')
globalThis.document = dom.window.document

const { state } = await import('../web/state.mjs')
const { fillGuide } = await import('../web/session.mjs')

beforeEach(() => {
  faker.seed(85)
  state.redraw = () => {}
  state.guide = { key: '', programs: [] }
  state.errorText = ''
})

test('xmltv da listagem baixa uma vez por playlist', async () => {
  let calls = 0
  const programs = [
    {
      channelId: faker.string.alpha(6),
      start: '20261030180000 +0000',
      stop: '20261030200000 +0000',
      title: faker.word.words(2),
    },
  ]
  state.playlistId = faker.string.alphanumeric(8)
  state.client = {
    epg: async () => {
      calls += 1
      return programs
    },
  }
  await fillGuide()
  await fillGuide()
  assert.equal(calls, 1)
  assert.equal(state.guide.programs, programs)
  assert.equal(state.guide.key, state.playlistId)
  assert.equal(state.guide.byChannel.get(programs[0].channelId).length, 1)
})
