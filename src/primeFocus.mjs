function wrap(index, dir, length) {
  if (length <= 0) return 0
  return (index + dir + length) % length
}

/** Foco 10-foot da tela Prime: trilho, fileiras ou detalhe. */
export function createPrimeFocus() {
  return { zone: 'rail', destIndex: 0, rowIndex: 0, cardIndex: 0 }
}

function moveRail(focus, key, destCount, rows) {
  if (key === 'ArrowDown') return { ...focus, destIndex: wrap(focus.destIndex, 1, destCount) }
  if (key === 'ArrowUp') return { ...focus, destIndex: wrap(focus.destIndex, -1, destCount) }
  if (key === 'ArrowRight') {
    if ((rows[0]?.cards.length ?? 0) === 0) return focus
    return { ...focus, zone: 'rows', rowIndex: 0, cardIndex: 0 }
  }
  return focus
}

function moveRows(focus, key, destCount, rows) {
  const cards = rows[focus.rowIndex]?.cards ?? []
  if (key === 'ArrowLeft' && focus.cardIndex === 0) return { ...focus, zone: 'rail' }
  if (key === 'ArrowLeft') return { ...focus, cardIndex: focus.cardIndex - 1 }
  if (key === 'ArrowRight') return { ...focus, cardIndex: wrap(focus.cardIndex, 1, cards.length) }
  if (key === 'ArrowDown') {
    return { ...focus, rowIndex: wrap(focus.rowIndex, 1, rows.length), cardIndex: 0 }
  }
  if (key === 'ArrowUp') {
    return { ...focus, rowIndex: wrap(focus.rowIndex, -1, rows.length), cardIndex: 0 }
  }
  return focus
}

/** Move o foco; detalhe aberto ignora setas. */
export function movePrimeFocus(focus, key, { destCount, rows, hasDetail = false }) {
  if (hasDetail) return focus
  if (focus.zone === 'rail') return moveRail(focus, key, destCount, rows)
  if (focus.zone === 'rows') return moveRows(focus, key, destCount, rows)
  return focus
}

/** Ação de Enter/Escape a partir do foco. */
export function primeFocusAction(focus, key, { hasDetail }) {
  if (hasDetail && (key === 'Escape' || key === 'Backspace')) return 'close-detail'
  if (key !== 'Enter') return null
  if (focus.zone === 'rail') return 'open-dest'
  if (focus.zone === 'rows') return 'open-detail'
  return null
}
