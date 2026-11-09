import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { createJsonBucket } from '../src/jsonBucket.mjs'
import {
  createThemeStore,
  DEFAULT_THEME,
  nextTheme,
  normalizeTheme,
  parseStoredTheme,
  themeButtonLabel,
  themeGlyph,
} from '../src/theme.mjs'
import { faker } from './factories.mjs'

beforeEach(() => {
  faker.seed(91)
})

test('normalizeTheme aceita dark e light', () => {
  assert.equal(normalizeTheme('dark'), 'dark')
  assert.equal(normalizeTheme('light'), 'light')
})

test('normalizeTheme recusa valor que não é dark|light', () => {
  const junk = faker.lorem.word()
  assert.throws(
    () => normalizeTheme(junk),
    new RegExp(`tema recusado: recebido "${junk}", esperado dark\\|light`),
  )
})

test('nextTheme alterna dark e light', () => {
  assert.equal(nextTheme('dark'), 'light')
  assert.equal(nextTheme('light'), 'dark')
})

test('parseStoredTheme cai no dark quando falta ou é lixo', () => {
  assert.equal(parseStoredTheme(undefined), DEFAULT_THEME)
  assert.equal(parseStoredTheme(faker.lorem.word()), DEFAULT_THEME)
  assert.equal(parseStoredTheme('light'), 'light')
})

test('themeButtonLabel descreve o modo para o qual o clique vai', () => {
  assert.equal(themeButtonLabel('dark'), 'Modo claro')
  assert.equal(themeButtonLabel('light'), 'Modo escuro')
})

test('themeGlyph mostra sol no escuro e lua no claro', () => {
  assert.equal(themeGlyph('dark'), 'sun')
  assert.equal(themeGlyph('light'), 'moon')
})

test('createThemeStore começa no dark e persiste o toggle', () => {
  const memory = new Map()
  const store = createThemeStore({
    bucket: createJsonBucket({ storage: mapStorage(memory), key: 'life-tv:theme' }),
  })
  assert.equal(store.get(), 'dark')
  assert.equal(store.toggle(), 'light')
  assert.equal(store.get(), 'light')
  const again = createThemeStore({
    bucket: createJsonBucket({ storage: mapStorage(memory), key: 'life-tv:theme' }),
  })
  assert.equal(again.get(), 'light')
})

function mapStorage(map) {
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null
    },
    setItem(key, value) {
      map.set(key, value)
    },
  }
}
