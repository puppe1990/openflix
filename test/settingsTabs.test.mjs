import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'

faker.seed(20261108)

const {
  DEFAULT_SETTINGS_TAB,
  SETTINGS_TABS,
  selectSettingsTab,
  settingsListsHidden,
  settingsPaneHidden,
} = await import('../src/settingsTabs.mjs')

beforeEach(() => {
  faker.seed(20261108)
})

test('Ajustes tem Playlists, Streaming, Prime Video e YouTube nessa ordem', () => {
  assert.deepEqual(
    SETTINGS_TABS.map((tab) => tab.id),
    ['playlists', 'streaming', 'prime', 'youtube'],
  )
  assert.deepEqual(
    SETTINGS_TABS.map((tab) => tab.label),
    ['Playlists', 'Streaming', 'Prime Video', 'YouTube'],
  )
})

test('aba inicial de Ajustes é Playlists', () => {
  assert.equal(DEFAULT_SETTINGS_TAB, 'playlists')
})

test('selectSettingsTab aceita as quatro abas e recusa o resto', () => {
  const picked = faker.helpers.arrayElement(['playlists', 'streaming', 'prime', 'youtube'])
  assert.equal(selectSettingsTab(picked), picked)
  const unknown = faker.word.noun()
  assert.throws(() => selectSettingsTab(unknown), {
    message: `aba de ajustes recusada: recebido ${unknown}, esperado playlists, streaming, prime ou youtube`,
  })
})

test('painel some quando a aba ativa é outra', () => {
  assert.equal(settingsPaneHidden('playlists', 'playlists'), false)
  assert.equal(settingsPaneHidden('playlists', 'streaming'), true)
  assert.equal(settingsPaneHidden('streaming', 'prime'), true)
  assert.equal(settingsPaneHidden('prime', 'prime'), false)
})

test('chips e nome somem nas abas Prime Video e YouTube', () => {
  assert.equal(settingsListsHidden('playlists'), false)
  assert.equal(settingsListsHidden('streaming'), false)
  assert.equal(settingsListsHidden('prime'), true)
  assert.equal(settingsListsHidden('youtube'), true)
})
