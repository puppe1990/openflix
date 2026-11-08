import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  actionClass,
  playlistChipClass,
  catalogDetailClass,
  catalogGridClass,
  catalogListsClass,
  itemCardClass,
  favToggleClass,
  catCountClass,
  catItemClass,
  catListClass,
  ghostClass,
  hudBrandClass,
  hudOverlayClass,
  hudPauseClass,
  itemClass,
  itemListClass,
  itemsPaneClass,
  liveBadgeClass,
  playerNoteClass,
  playerTitleClass,
  playerUrlClass,
  qualityPanelClass,
  tabClass,
  tileClass,
} from '../src/tvSkin.mjs'

test('tile selecionado usa o vermelho de destaque', () => {
  const cls = tileClass(true)
  assert.match(cls, /ring-accent/)
  assert.match(cls, /bg-row/)
})

test('tile ocioso fica no painel escuro', () => {
  const cls = tileClass(false)
  assert.match(cls, /text-ink/)
  assert.match(cls, /bg-panel/)
  assert.equal(cls.includes('ring-accent'), false)
})

test('item selecionado marca o anel vermelho', () => {
  const cls = itemClass(true)
  assert.match(cls, /ring-accent/)
  assert.match(cls, /bg-row/)
})

test('chip de categoria ativa é vermelho cheio', () => {
  assert.match(catItemClass(true), /bg-accent/)
  assert.equal(catItemClass(false).includes('bg-accent'), false)
  assert.match(catCountClass(), /text-mute/)
})

test('aba ativa fica branca e em negrito', () => {
  assert.match(tabClass(true), /text-ink/)
  assert.match(tabClass(true), /font-bold/)
  assert.match(tabClass(false), /text-mute/)
})

test('ação primária é o botão branco de assistir', () => {
  assert.match(actionClass(), /bg-action/)
  assert.match(actionClass(), /text-void/)
  assert.match(actionClass(), /cursor-pointer/)
})

test('ação secundária é superfície fumê', () => {
  assert.match(ghostClass(), /bg-row/)
  assert.match(ghostClass(), /text-ink/)
})

test('chip da playlist ativa usa o vermelho', () => {
  assert.match(playlistChipClass(true), /bg-accent/)
  assert.match(playlistChipClass(false), /bg-panel/)
})

test('selo ao vivo usa o vermelho da marca', () => {
  assert.match(liveBadgeClass(), /bg-accent/)
})

test('HUD cinema cobre o quadro e pinta a pílula OpenFlix', () => {
  assert.match(hudOverlayClass(), /absolute/)
  assert.match(hudOverlayClass(), /inset-0/)
  assert.match(hudPauseClass(), /rounded-2xl/)
  assert.match(hudBrandClass(), /tracking-\[0\.16em\]/)
  assert.match(qualityPanelClass(), /bottom-24/)
})

test('player usa URL em cinza e título Chivo', () => {
  assert.match(playerUrlClass(), /text-mute/)
  assert.match(playerTitleClass(), /font-display/)
  assert.match(playerNoteClass(), /text-mute/)
})

test('listas do catálogo são list-none 10-foot', () => {
  assert.match(catListClass(), /list-none/)
  assert.match(itemListClass(), /list-none/)
})

test('chips de categoria ficam numa faixa horizontal', () => {
  const cls = catListClass()
  assert.match(cls, /flex-nowrap/)
  assert.match(cls, /overflow-x-auto/)
  assert.equal(cls.includes('flex-wrap'), false)
})

test('categorias ao vivo ficam numa lista vertical', () => {
  const cls = catListClass('live')
  assert.match(cls, /flex-col/)
  assert.match(cls, /overflow-y-auto/)
  assert.equal(cls.includes('flex-nowrap'), false)
})

test('item de categoria ao vivo é uma linha de largura total', () => {
  assert.match(catItemClass(true, 'live'), /w-full/)
  assert.match(catItemClass(true, 'live'), /bg-accent/)
  assert.equal(catItemClass(false, 'live').includes('bg-accent'), false)
})

test('grade ao vivo é duas colunas: categorias | canais', () => {
  const cls = catalogGridClass('live')
  assert.match(cls, /grid-cols-\[18rem/)
  assert.equal(catalogDetailClass('live').includes('hidden'), true)
  assert.equal(catalogGridClass('live').includes('xl:grid-cols-12'), false)
})

test('grade ao vivo trava a altura da linha para a sidebar não esticar', () => {
  const cls = catalogGridClass('live')
  assert.match(cls, /grid-rows-\[minmax\(0,1fr\)\]/)
  assert.match(cls, /overflow-hidden/)
  assert.match(cls, /min-h-0/)
})

test('botão de favorito na listagem muda de cinza pra vermelho', () => {
  assert.match(favToggleClass(false), /text-mute/)
  assert.equal(favToggleClass(false).includes('text-accent'), false)
  assert.match(favToggleClass(true), /text-accent/)
  assert.match(favToggleClass(true, true), /bottom-2/)
})

test('canais ao vivo em cards usam faixa com largura explícita', () => {
  const cls = itemListClass('live', 'card')
  assert.match(cls, /flex-wrap/)
  assert.match(cls, /w-full/)
  assert.match(cls, /min-w-0/)
  assert.match(cls, /flex-1/)
  assert.equal(cls.includes('flex-col'), false)
  assert.equal(cls.includes('grid-cols-3'), false)
  assert.match(itemCardClass(true), /w-\[calc/)
  assert.match(itemCardClass(true), /ring-accent/)
})

test('filmes e séries usam a grade de listagem do ao vivo', () => {
  for (const kind of ['movies', 'series']) {
    const grid = catalogGridClass(kind)
    assert.match(grid, /grid-cols-\[18rem/)
    assert.match(grid, /grid-rows-\[minmax\(0,1fr\)\]/)
    assert.equal(catalogDetailClass(kind).includes('hidden'), true)
    assert.equal(catalogListsClass(kind), 'contents')
    assert.match(catListClass(kind), /flex-col/)
    assert.equal(catListClass(kind).includes('flex-nowrap'), false)
    assert.match(catItemClass(true, kind), /w-full/)
    assert.match(itemsPaneClass(kind), /h-full/)
    assert.match(itemListClass(kind), /flex-1/)
    assert.match(itemListClass(kind, 'card'), /flex-wrap/)
  }
})
