import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import {
  bindCatalog,
  createTvShell,
  focusHome,
  goBack,
  handleKey,
  moveCatalog,
  moveHome,
  openHomeTile,
} from '../src/tvShell.mjs'
import { faker, fakerCategory, fakerLiveStream } from './factories.mjs'
import { mapCatalog } from '../src/mapCatalog.mjs'

beforeEach(() => {
  faker.seed(51)
})

test('home começa em Ao vivo e o D-pad cicla os quatro tiles', () => {
  let shell = createTvShell()
  assert.equal(shell.screen, 'home')
  assert.equal(shell.homeId, 'live')
  shell = moveHome(shell, 1)
  assert.equal(shell.homeId, 'movies')
  shell = moveHome(shell, 1)
  assert.equal(shell.homeId, 'series')
  shell = moveHome(shell, 1)
  assert.equal(shell.homeId, 'settings')
  shell = moveHome(shell, 1)
  assert.equal(shell.homeId, 'live')
})

test('Enter em Ao vivo abre catálogo live vazio', () => {
  const shell = openHomeTile(createTvShell())
  assert.equal(shell.screen, 'catalog')
  assert.equal(shell.catalogKind, 'live')
})

test('focusHome abre o tile de séries do FlexTV', () => {
  const shell = openHomeTile(focusHome(createTvShell(), 'series'))
  assert.equal(shell.homeId, 'series')
  assert.equal(shell.screen, 'catalog')
  assert.equal(shell.catalogKind, 'series')
})

test('Enter em Ajustes abre settings', () => {
  let shell = createTvShell()
  shell = moveHome(shell, -1)
  assert.equal(shell.homeId, 'settings')
  shell = openHomeTile(shell)
  assert.equal(shell.screen, 'settings')
})

test('bindCatalog e D-pad escolhem item do faker', () => {
  const cat = fakerCategory({ id: 1, name: faker.commerce.department() })
  const a = fakerLiveStream({ categoryId: 1, name: faker.company.name() })
  const b = fakerLiveStream({ categoryId: 1, name: faker.company.name() })
  const catalog = mapCatalog({ kind: 'live', categories: [cat], streams: [a, b] })
  let shell = bindCatalog(openHomeTile(createTvShell()), catalog)
  assert.equal(shell.catalog.categories[0].name, 'Todos')
  assert.equal(shell.selectedItem.id, a.stream_id)
  shell = moveCatalog(shell, 1)
  assert.equal(shell.selectedItem.id, b.stream_id)
  assert.equal(shell.selectedItem.name, b.name)
})

test('Escape no catálogo volta pra home', () => {
  const shell = goBack(openHomeTile(createTvShell()))
  assert.equal(shell.screen, 'home')
  assert.equal(shell.homeId, 'live')
})

test('Escape conserva o catálogo já carregado', () => {
  const cat = fakerCategory({ id: 1 })
  const stream = fakerLiveStream({ categoryId: 1 })
  const catalog = mapCatalog({ kind: 'live', categories: [cat], streams: [stream] })
  const bound = bindCatalog(openHomeTile(createTvShell()), catalog)
  const home = goBack(bound)
  assert.equal(home.screen, 'home')
  assert.equal(home.catalog, bound.catalog)
})

test('voltar pra home e abrir a mesma aba reusa o catálogo', () => {
  const cat = fakerCategory({ id: 1 })
  const stream = fakerLiveStream({ categoryId: 1 })
  const catalog = mapCatalog({ kind: 'live', categories: [cat], streams: [stream] })
  const bound = bindCatalog(openHomeTile(createTvShell()), catalog)
  const again = openHomeTile(goBack(bound))
  assert.equal(again.screen, 'catalog')
  assert.equal(again.catalogKind, 'live')
  assert.equal(again.catalog, bound.catalog)
  assert.equal(again.selectedItem.id, stream.stream_id)
})

test('abrir outra aba zera o catálogo', () => {
  const cat = fakerCategory({ id: 1 })
  const stream = fakerLiveStream({ categoryId: 1 })
  const catalog = mapCatalog({ kind: 'live', categories: [cat], streams: [stream] })
  const bound = bindCatalog(openHomeTile(createTvShell()), catalog)
  const movies = openHomeTile(focusHome(goBack(bound), 'movies'))
  assert.equal(movies.screen, 'catalog')
  assert.equal(movies.catalogKind, 'movies')
  assert.equal(movies.catalog, null)
})

test('handleKey mapeia D-pad da home e Enter', () => {
  let shell = handleKey(createTvShell(), 'ArrowRight')
  assert.equal(shell.homeId, 'movies')
  shell = handleKey(shell, 'Enter')
  assert.equal(shell.screen, 'catalog')
  assert.equal(shell.catalogKind, 'movies')
  shell = handleKey(shell, 'Escape')
  assert.equal(shell.screen, 'home')
})

test('bindCatalog de filmes também coloca Todos na frente', () => {
  const title = faker.lorem.words(2)
  const catalog = {
    kind: 'vod',
    categories: [
      {
        id: '1',
        name: faker.commerce.department(),
        items: [{ id: faker.number.int({ min: 10, max: 99 }), name: title }],
      },
    ],
  }
  const shell = bindCatalog(openHomeTile(focusHome(createTvShell(), 'movies')), catalog)
  assert.equal(shell.catalog.categories[0].name, 'Todos')
  assert.equal(shell.selectedItem.name, title)
})

test('Enter no item do faker abre o player', () => {
  const cat = fakerCategory({ id: 1 })
  const stream = fakerLiveStream({ categoryId: 1 })
  const catalog = mapCatalog({ kind: 'live', categories: [cat], streams: [stream] })
  let shell = bindCatalog(openHomeTile(createTvShell()), catalog)
  shell = handleKey(shell, 'Enter')
  assert.equal(shell.screen, 'player')
  assert.equal(shell.selectedItem.id, stream.stream_id)
})
