import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createYoutubeFocus, moveYoutubeFocus, youtubeFocusAction } from '../src/youtubeFocus.mjs'

const rows = [{ cards: [{ videoId: 'a' }, { videoId: 'b' }] }, { cards: [{ videoId: 'c' }] }]

test('setas no trilho e nas fileiras; Enter no card toca na hora', () => {
  let focus = createYoutubeFocus()
  assert.equal(focus.zone, 'rail')
  focus = moveYoutubeFocus(focus, 'ArrowDown', { destCount: 4, rows })
  assert.equal(focus.destIndex, 1)
  focus = moveYoutubeFocus(focus, 'ArrowRight', { destCount: 4, rows })
  assert.equal(focus.zone, 'rows')
  assert.equal(youtubeFocusAction(focus, 'Enter', { hasDetail: false }), 'play-card')
  assert.equal(youtubeFocusAction(createYoutubeFocus(), 'Enter', { hasDetail: false }), 'open-dest')
})

test('Escape no detalhe fecha; Enter no detalhe toca; esquerda volta ao trilho', () => {
  const rowsFocus = { zone: 'rows', destIndex: 0, rowIndex: 0, cardIndex: 0 }
  const next = moveYoutubeFocus(rowsFocus, 'ArrowLeft', { destCount: 3, rows })
  assert.equal(next.zone, 'rail')
  assert.equal(youtubeFocusAction(rowsFocus, 'Escape', { hasDetail: true }), 'close-detail')
  assert.equal(youtubeFocusAction(rowsFocus, 'Enter', { hasDetail: true }), 'play-detail')
})
