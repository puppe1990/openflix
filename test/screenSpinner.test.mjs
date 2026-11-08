import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import {
  isScreenChange,
  SPINNER_MIN_MS,
  spinnerLabel,
  spinnerRemainingMs,
} from '../src/screenSpinner.mjs'

beforeEach(() => {
  faker.seed(104)
})

test('spinnerLabel descreve cada tela do 10-foot', () => {
  assert.equal(spinnerLabel('catalog', 'live'), 'Abrindo ao vivo…')
  assert.equal(spinnerLabel('catalog', 'movies'), 'Abrindo filmes…')
  assert.equal(spinnerLabel('catalog', 'series'), 'Abrindo séries…')
  assert.equal(spinnerLabel('player'), 'Abrindo reprodução…')
  assert.equal(spinnerLabel('prime'), 'Abrindo Prime Video…')
  assert.equal(spinnerLabel('youtube'), 'Abrindo YouTube…')
  assert.equal(spinnerLabel('settings'), 'Abrindo ajustes…')
  assert.equal(spinnerLabel('home'), 'Abrindo início…')
})

test('spinnerLabel desconhecido cai em Carregando', () => {
  const screen = faker.string.alpha({ length: 8 })
  assert.equal(spinnerLabel(screen), 'Carregando…')
})

test('isScreenChange ignora o mesmo catálogo', () => {
  assert.equal(
    isScreenChange(
      { screen: 'catalog', catalogKind: 'live' },
      { screen: 'catalog', catalogKind: 'live' },
    ),
    false,
  )
})

test('isScreenChange vê troca de aba e de player', () => {
  assert.equal(
    isScreenChange(
      { screen: 'catalog', catalogKind: 'live' },
      { screen: 'catalog', catalogKind: 'movies' },
    ),
    true,
  )
  assert.equal(
    isScreenChange({ screen: 'catalog', catalogKind: 'live' }, { screen: 'player' }),
    true,
  )
  assert.equal(isScreenChange({ screen: 'player' }, { screen: 'home' }), true)
})

test('spinnerRemainingMs espera o mínimo e zera depois', () => {
  const startedAt = faker.number.int({ min: 1_000, max: 9_000 })
  assert.equal(spinnerRemainingMs(startedAt, startedAt + 80, SPINNER_MIN_MS), SPINNER_MIN_MS - 80)
  assert.equal(spinnerRemainingMs(startedAt, startedAt + SPINNER_MIN_MS + 40), 0)
})

test('spinnerRemainingMs recusa relógio inválido', () => {
  assert.throws(
    () => spinnerRemainingMs('agora', 10, 320),
    /relógio recusado: recebido startedAt "agora", esperado número/,
  )
})
