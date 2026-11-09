import assert from 'node:assert/strict'
import { test } from 'node:test'
import { YOUTUBE_CHROME_DESTS, YOUTUBE_HOME_DEST, youtubeDest } from '../src/youtubeNav.mjs'

test('trilho chrome tem Início, Inscrições, Histórico e Biblioteca', () => {
  assert.deepEqual(
    YOUTUBE_CHROME_DESTS.map((dest) => dest.key),
    ['FEwhat_to_watch', 'FEsubscriptions', 'FEhistory', 'FElibrary'],
  )
  assert.deepEqual(
    YOUTUBE_CHROME_DESTS.map((dest) => dest.label),
    ['Início', 'Inscrições', 'Histórico', 'Biblioteca'],
  )
  assert.equal(YOUTUBE_HOME_DEST.key, 'FEwhat_to_watch')
  assert.equal(YOUTUBE_HOME_DEST.group, 'YouTube')
})

test('youtubeDest acha pelo browseId e recusa o resto', () => {
  const dest = youtubeDest(YOUTUBE_CHROME_DESTS, 'FElibrary')
  assert.equal(dest.label, 'Biblioteca')
  assert.throws(
    () => youtubeDest(YOUTUBE_CHROME_DESTS, 'FEtrending'),
    /destino do youtube recusado: recebido FEtrending, esperado FEwhat_to_watch, FEsubscriptions, FEhistory ou FElibrary/,
  )
  assert.throws(
    () => youtubeDest(YOUTUBE_CHROME_DESTS, 'FEmusic_home'),
    /destino do youtube recusado: recebido FEmusic_home, esperado FEwhat_to_watch, FEsubscriptions, FEhistory ou FElibrary/,
  )
})
