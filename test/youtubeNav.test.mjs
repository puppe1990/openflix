import assert from 'node:assert/strict'
import { test } from 'node:test'
import { YOUTUBE_CHROME_DESTS, YOUTUBE_HOME_DEST, youtubeDest } from '../src/youtubeNav.mjs'

test('trilho chrome tem Início, Inscrições, Histórico e Em alta', () => {
  assert.deepEqual(
    YOUTUBE_CHROME_DESTS.map((dest) => dest.key),
    ['FEwhat_to_watch', 'FEsubscriptions', 'FEhistory', 'FEtrending'],
  )
  assert.deepEqual(
    YOUTUBE_CHROME_DESTS.map((dest) => dest.label),
    ['Início', 'Inscrições', 'Histórico', 'Em alta'],
  )
  assert.equal(YOUTUBE_HOME_DEST.key, 'FEwhat_to_watch')
  assert.equal(YOUTUBE_HOME_DEST.group, 'YouTube')
})

test('youtubeDest acha pelo browseId e recusa o resto', () => {
  const dest = youtubeDest(YOUTUBE_CHROME_DESTS, 'FEtrending')
  assert.equal(dest.label, 'Em alta')
  assert.throws(
    () => youtubeDest(YOUTUBE_CHROME_DESTS, 'FEmusic_home'),
    /destino do youtube recusado: recebido FEmusic_home, esperado FEwhat_to_watch, FEsubscriptions, FEhistory ou FEtrending/,
  )
})
