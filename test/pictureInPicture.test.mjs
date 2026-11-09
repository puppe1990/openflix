import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  isPlayingVideo,
  restorePlayerFromPip,
  shouldPictureInPicture,
} from '../src/pictureInPicture.mjs'
import { createTvShell } from '../src/tvShell.mjs'
import { faker, fakerYoutubeVideoId } from './factories.mjs'

faker.seed(77)

test('PiP quando saiu do player e o vídeo está tocando', () => {
  assert.equal(shouldPictureInPicture({ screen: 'home', playing: true }), true)
  assert.equal(shouldPictureInPicture({ screen: 'catalog', playing: true }), true)
  assert.equal(shouldPictureInPicture({ screen: 'settings', playing: true }), true)
})

test('sem PiP na tela do player', () => {
  assert.equal(shouldPictureInPicture({ screen: 'player', playing: true }), false)
})

test('sem PiP quando o player não está tocando', () => {
  assert.equal(shouldPictureInPicture({ screen: 'home', playing: false }), false)
})

test('playing recusa valor que não é boolean', () => {
  assert.throws(() => shouldPictureInPicture({ screen: 'home', playing: 'yes' }), /boolean/)
})

test('isPlayingVideo exige paused false e ended false', () => {
  assert.equal(isPlayingVideo({ paused: false, ended: false }), true)
  assert.equal(isPlayingVideo({ paused: true, ended: false }), false)
  assert.equal(isPlayingVideo({ paused: false, ended: true }), false)
  assert.equal(isPlayingVideo(null), false)
})

test('voltar do PiP reabre o player com o item que estava tocando', () => {
  const item = { id: faker.number.int({ min: 1, max: 99 }), name: faker.lorem.words(2) }
  const shell = restorePlayerFromPip(createTvShell(), {
    catalogKind: 'live',
    selectedItem: item,
  })
  assert.equal(shell.screen, 'player')
  assert.equal(shell.catalogKind, 'live')
  assert.equal(shell.selectedItem, item)
})

test('voltar do PiP recusa snapshot sem item', () => {
  assert.throws(() => restorePlayerFromPip(createTvShell(), {}), /selectedItem/)
})

test('voltar do PiP reabre o player do YouTube', () => {
  const videoId = fakerYoutubeVideoId()
  const item = {
    id: videoId,
    name: faker.lorem.words(3),
    url: `http://127.0.0.1:43111/video/${videoId}.mp4`,
  }
  const shell = restorePlayerFromPip(createTvShell(), {
    catalogKind: 'youtube',
    selectedItem: item,
  })
  assert.equal(shell.screen, 'player')
  assert.equal(shell.catalogKind, 'youtube')
  assert.equal(shell.selectedItem, item)
})

test('voltar do PiP do YouTube infere o destino quando catalogKind veio vazio', () => {
  const videoId = fakerYoutubeVideoId()
  const item = {
    id: videoId,
    name: faker.lorem.words(3),
    url: `http://127.0.0.1:43111/video/${videoId}.m3u8`,
  }
  const shell = restorePlayerFromPip(createTvShell(), {
    catalogKind: null,
    selectedItem: item,
  })
  assert.equal(shell.screen, 'player')
  assert.equal(shell.catalogKind, 'youtube')
  assert.equal(shell.selectedItem, item)
})
