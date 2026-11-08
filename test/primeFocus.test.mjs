import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPrimeFocus, movePrimeFocus, primeFocusAction } from '../src/primeFocus.mjs'

const rows = [{ cards: [{ titleId: 'a' }, { titleId: 'b' }] }, { cards: [{ titleId: 'c' }] }]

test('setas no trilho e nas fileiras, Enter abre destino ou detalhe', () => {
  let focus = createPrimeFocus()
  assert.equal(focus.zone, 'rail')
  focus = movePrimeFocus(focus, 'ArrowDown', { destCount: 4, rows })
  assert.equal(focus.destIndex, 1)
  focus = movePrimeFocus(focus, 'ArrowRight', { destCount: 4, rows })
  assert.equal(focus.zone, 'rows')
  assert.equal(focus.cardIndex, 0)
  focus = movePrimeFocus(focus, 'ArrowRight', { destCount: 4, rows })
  assert.equal(focus.cardIndex, 1)
  focus = movePrimeFocus(focus, 'ArrowDown', { destCount: 4, rows })
  assert.equal(focus.rowIndex, 1)
  assert.equal(focus.cardIndex, 0)
  assert.equal(primeFocusAction(focus, 'Enter', { hasDetail: false }), 'open-detail')
  assert.equal(primeFocusAction(createPrimeFocus(), 'Enter', { hasDetail: false }), 'open-dest')
})

test('Escape no detalhe fecha; seta esquerda no primeiro card volta ao trilho', () => {
  const rowsFocus = { zone: 'rows', destIndex: 0, rowIndex: 0, cardIndex: 0 }
  const next = movePrimeFocus(rowsFocus, 'ArrowLeft', { destCount: 3, rows })
  assert.equal(next.zone, 'rail')
  assert.equal(primeFocusAction(rowsFocus, 'Escape', { hasDetail: true }), 'close-detail')
  assert.equal(primeFocusAction(rowsFocus, 'Enter', { hasDetail: true }), 'play-detail')
})

test('Escape no painel fecha o player; setas e Enter não mexem o catálogo por baixo', () => {
  const focus = createPrimeFocus()
  const next = movePrimeFocus(focus, 'ArrowDown', { destCount: 4, rows, hasPane: true })
  assert.equal(next.destIndex, 0)
  assert.equal(primeFocusAction(focus, 'Escape', { hasDetail: false, hasPane: true }), 'close-pane')
  assert.equal(primeFocusAction(focus, 'Enter', { hasDetail: false, hasPane: true }), null)
  assert.equal(
    primeFocusAction(focus, 'Escape', { hasDetail: true, hasPane: true }),
    'close-detail',
  )
})
