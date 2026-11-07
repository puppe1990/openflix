import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { faker } from './factories.mjs'

const dom = new JSDOM(`<!doctype html><body>
  <section id="home"></section>
  <section id="catalog" hidden>
    <div id="catalog-grid">
      <aside id="detail"></aside>
      <div id="catalog-lists">
        <ul id="categories"></ul>
        <div id="items-pane">
          <div id="items-toolbar"></div>
          <ul id="items"></ul>
        </div>
      </div>
    </div>
    <div id="shelf"></div>
  </section>
  <input id="search" value="" />
  <button id="tab-inicio"></button><button id="tab-live"></button>
  <button id="tab-movies"></button><button id="tab-series"></button>
  <button id="tab-settings"></button>
</body>`)

globalThis.document = dom.window.document

const { setRedraw, state } = await import('../web/state.mjs')
const { renderCatalog, renderHome, renderTabs, selectCategory, selectItem } =
  await import('../web/catalogView.mjs')
const { CHANNEL_CARD_PAGE } = await import('../src/channelLayout.mjs')
const { indexProgramsByChannel } = await import('../src/xmltvNowNext.mjs')
const { createTvShell } = await import('../src/tvShell.mjs')
const { favStore, historyStore } = await import('../web/stores.mjs')

beforeEach(() => {
  faker.seed(57)
  dom.window.document.getElementById('search').value = ''
  state.shell = createTvShell()
  state.channelLayout = 'list'
  state.itemLimit = CHANNEL_CARD_PAGE
  state.guide = { programs: [] }
  state.redraw = () => {}
  historyStore.clear()
  favStore.clear()
})

function moviesCatalog() {
  const first = { id: faker.number.int({ min: 10, max: 99 }), name: 'Alfa', extension: 'mp4' }
  const second = { id: faker.number.int({ min: 100, max: 999 }), name: 'Beta', extension: 'mkv' }
  return {
    kind: 'movies',
    categories: [{ id: '1', name: 'Ação', items: [first, second] }],
    first,
  }
}

test('home desenha os quatro tiles e marca o selecionado', () => {
  renderHome()
  const tiles = document.querySelectorAll('#home [data-tile]')
  assert.equal(tiles.length, 4)
  assert.equal(tiles[0].getAttribute('aria-selected'), 'true')
  assert.equal(tiles[0].dataset.tile, 'live')
})

test('catálogo desenha categorias com contagem e itens numerados', () => {
  const { categories, first } = moviesCatalog()
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'movies',
    catalog: { kind: 'movies', categories },
    selectedItem: first,
  }
  renderCatalog()

  const rows = document.querySelectorAll('#categories li')
  assert.equal(rows.length, 2)
  assert.match(rows[0].textContent, /Todos/)
  assert.match(rows[1].textContent, /Ação/)
  assert.match(rows[1].textContent, /2/)

  const items = document.querySelectorAll('#items li')
  assert.equal(items.length, 2)
  assert.match(items[0].textContent, /01/)
  assert.equal(items[0].getAttribute('aria-selected'), 'true')
})

test('listagem de filmes mostra título e favorito, detalhe escondido', () => {
  const { categories, first } = moviesCatalog()
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'movies',
    catalog: { kind: 'movies', categories },
    selectedItem: first,
  }
  renderCatalog()

  assert.match(document.querySelector('#items li').textContent, /Alfa/)
  assert.equal(document.querySelector('[data-list-fav]').dataset.listFav, String(first.id))
  assert.match(document.getElementById('detail').className, /hidden/)
  assert.equal(document.getElementById('detail').textContent, '')
})

test('selectCategory troca a categoria e seleciona o primeiro item', () => {
  const { categories } = moviesCatalog()
  const other = {
    id: '2',
    name: 'Drama',
    items: [{ id: faker.number.int({ min: 1000, max: 9999 }), name: 'Gama', extension: 'mp4' }],
  }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'movies',
    catalog: { kind: 'movies', categories: [...categories, other] },
    selectedItem: categories[0].items[0],
  }
  selectCategory(1)
  assert.equal(state.shell.categoryIndex, 1)
  assert.equal(state.shell.selectedItem.name, 'Gama')
})

test('selectItem abre o player no item escolhido', () => {
  const { categories } = moviesCatalog()
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'movies',
    catalog: { kind: 'movies', categories },
    selectedItem: categories[0].items[0],
  }
  selectItem(categories[0].items[1])
  assert.equal(state.shell.screen, 'player')
  assert.equal(state.shell.itemIndex, 1)
})

test('abas marcam a ativa em negrito', () => {
  state.shell = { ...createTvShell(), screen: 'catalog', catalogKind: 'movies' }
  renderTabs()
  assert.match(document.getElementById('tab-movies').className, /font-bold/)
  assert.equal(document.getElementById('tab-inicio').className.includes('font-bold'), false)
})

test('home mostra o destaque quando há item escolhido', () => {
  state.featured = { kind: 'live', name: 'TV Cultura', id: 101 }
  renderHome()
  const hero = document.querySelector('#home article')
  assert.ok(hero)
  assert.match(hero.textContent, /TV Cultura/)
  assert.match(hero.textContent, /Ao vivo/)
  assert.equal(document.querySelectorAll('#home [data-tile]').length, 4)
  state.featured = null
})

test('home esconde Continuar assistindo e Favoritos quando estão vazios', () => {
  renderHome()
  const text = document.querySelector('#home').textContent
  assert.equal(text.includes('Continuar assistindo'), false)
  assert.equal(text.includes('Favoritos'), false)
})

test('home mostra Continuar assistindo e abre o player no clique', () => {
  historyStore.remember({
    streamId: String(faker.number.int({ min: 1000, max: 9999 })),
    name: 'ESPN 1 HD',
    catalogKind: 'live',
  })
  renderHome()
  const home = document.querySelector('#home')
  assert.match(home.textContent, /Continuar assistindo/)
  assert.match(home.textContent, /ESPN 1 HD/)
  document.querySelector('[data-home-card="history"]').click()
  assert.equal(state.shell.screen, 'player')
  assert.equal(state.shell.catalogKind, 'live')
  assert.equal(state.shell.selectedItem.name, 'ESPN 1 HD')
})

test('home mostra Favoritos e abre o player no clique', () => {
  const streamId = String(faker.number.int({ min: 1000, max: 9999 }))
  favStore.toggleFav(streamId, {
    streamId,
    name: 'Band Sports',
    catalogKind: 'live',
  })
  renderHome()
  const home = document.querySelector('#home')
  assert.match(home.textContent, /Favoritos/)
  assert.match(home.textContent, /Band Sports/)
  document.querySelector('[data-home-card="fav"]').click()
  assert.equal(state.shell.screen, 'player')
  assert.equal(state.shell.selectedItem.name, 'Band Sports')
})

test('Favoritar na listagem aparece na home', () => {
  const { categories, first } = moviesCatalog()
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'movies',
    catalog: { kind: 'movies', categories },
    selectedItem: first,
  }
  renderCatalog()
  const favButton = document.querySelector(`[data-list-fav="${first.id}"]`)
  setRedraw(renderCatalog)
  favButton.click()
  state.shell = { ...state.shell, screen: 'home' }
  renderHome()
  assert.match(document.querySelector('#home').textContent, /Favoritos/)
  assert.match(document.querySelector('#home').textContent, /Alfa/)
})

test('catálogo ao vivo mostra marca e selo no detalhe', () => {
  const first = { id: 521, name: 'ESPN 1 HD', icon: '' }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'live',
    catalog: { kind: 'live', categories: [{ id: '1', name: 'Esportes', items: [first] }] },
    selectedItem: first,
  }
  renderCatalog()
  assert.match(document.querySelector('#items li').textContent, /E1/)
  assert.match(document.querySelector('#items li').textContent, /01/)
  assert.match(document.querySelector('#items li').textContent, /No ar/)
})

test('catálogo ao vivo põe categorias à esquerda e canais à direita', () => {
  const sports = {
    id: '1',
    name: 'Esportes',
    items: [{ id: 521, name: 'ESPN 1 HD', icon: '' }],
  }
  const news = {
    id: '2',
    name: 'Notícias',
    items: [{ id: 101, name: 'TV Cultura', icon: '' }],
  }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'live',
    catalog: { kind: 'live', categories: [sports, news] },
    selectedItem: sports.items[0],
  }
  renderCatalog()

  assert.match(document.getElementById('catalog-grid').className, /grid-cols-\[18rem/)
  assert.match(document.getElementById('categories').className, /flex-col/)
  assert.equal(document.getElementById('categories').className.includes('flex-nowrap'), false)
  assert.match(document.getElementById('items').className, /flex-col/)
  assert.match(document.getElementById('detail').className, /hidden/)
  assert.equal(document.getElementById('shelf').childNodes.length, 0)

  const cats = document.querySelectorAll('#categories li')
  assert.equal(cats.length, 3)
  assert.match(cats[0].textContent, /Todos/)
  assert.match(cats[0].textContent, /2/)
  assert.match(cats[0].className, /w-full/)
  assert.equal(document.querySelectorAll('#items li').length, 2)
  setRedraw(renderCatalog)
  cats[2].click()
  assert.equal(state.shell.categoryIndex, 2)
  assert.equal(state.shell.selectedItem.name, 'TV Cultura')
  assert.match(document.querySelector('#items li').textContent, /TV Cultura/)
})

test('clicar num canal ao vivo seleciona e abre o player', () => {
  const first = { id: 521, name: 'ESPN 1 HD', icon: '' }
  const second = { id: 522, name: 'Band Sports', icon: '' }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'live',
    catalog: { kind: 'live', categories: [{ id: '1', name: 'Esportes', items: [first, second] }] },
    selectedItem: first,
  }
  renderCatalog()
  document.querySelectorAll('#items li')[1].click()
  assert.equal(state.shell.selectedItem.name, 'Band Sports')
  assert.equal(state.shell.screen, 'player')
})

test('listagem ao vivo favorita o canal sem abrir o player', () => {
  const first = { id: 521, name: 'ESPN 1 HD', icon: '' }
  const second = { id: 522, name: 'Band Sports', icon: '' }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'live',
    catalog: { kind: 'live', categories: [{ id: '1', name: 'Esportes', items: [first, second] }] },
    selectedItem: first,
  }
  renderCatalog()
  const fav = document.querySelector('[data-list-fav="521"]')
  assert.equal(fav.getAttribute('aria-label'), 'Favoritar')
  assert.equal(fav.getAttribute('aria-pressed'), 'false')
  setRedraw(renderCatalog)
  fav.click()
  assert.equal(favStore.isFav(521), true)
  assert.equal(state.shell.screen, 'catalog')
  const on = document.querySelector('[data-list-fav="521"]')
  assert.equal(on.getAttribute('aria-pressed'), 'true')
  assert.equal(on.getAttribute('aria-label'), 'Remover favorito')
})

test('modo card também mostra o favorito no canal', () => {
  const first = { id: 521, name: 'ESPN 1 HD', icon: '' }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'live',
    catalog: { kind: 'live', categories: [{ id: '1', name: 'Esportes', items: [first] }] },
    selectedItem: first,
  }
  state.channelLayout = 'card'
  renderCatalog()
  assert.equal(document.querySelector('[data-list-fav="521"]').tagName, 'BUTTON')
})

test('Filmes na listagem ganha o favorito da linha ao vivo', () => {
  const { categories, first } = moviesCatalog()
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'movies',
    catalog: { kind: 'movies', categories },
    selectedItem: first,
  }
  renderCatalog()
  assert.equal(document.querySelector('[data-list-fav]').dataset.listFav, String(first.id))
})

test('botão Cards troca a listagem ao vivo para grade', () => {
  const first = { id: 521, name: 'ESPN 1 HD', icon: '' }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'live',
    catalog: { kind: 'live', categories: [{ id: '1', name: 'Esportes', items: [first] }] },
    selectedItem: first,
  }
  renderCatalog()
  const toggle = document.querySelector('[data-channel-layout]')
  assert.equal(toggle.textContent.trim(), 'Cards')
  assert.equal(document.getElementById('items').className.includes('flex-col'), true)
  setRedraw(renderCatalog)
  toggle.click()
  assert.equal(state.channelLayout, 'card')
  assert.match(document.getElementById('items').className, /flex-wrap/)
  assert.match(document.getElementById('items').className, /w-full/)
  assert.match(document.querySelector('[data-channel-layout]').textContent, /Lista/)
  assert.match(document.querySelector('#items li').className, /flex-col/)
  assert.match(document.querySelector('#items li').className, /w-\[calc/)
})

function liveTodos(count) {
  const items = Array.from({ length: count }, (_, index) => ({
    id: 1000 + index,
    name: `Canal ${index + 1}`,
    icon: '',
  }))
  return {
    items,
    shell: {
      ...createTvShell(),
      screen: 'catalog',
      catalogKind: 'live',
      catalog: { kind: 'live', categories: [{ id: '1', name: 'Todos', items }] },
      selectedItem: items[0],
    },
  }
}

test('modo card não pinta milhares de canais de uma vez', () => {
  const { shell } = liveTodos(80)
  state.shell = shell
  state.channelLayout = 'card'
  renderCatalog()
  assert.equal(document.querySelectorAll('#items li').length, CHANNEL_CARD_PAGE)
  assert.match(document.querySelector('#items li').textContent, /Canal 1/)
})

test('lista ao vivo também pinta só a primeira página e cresce no scroll', () => {
  const { shell } = liveTodos(80)
  state.shell = shell
  state.channelLayout = 'list'
  renderCatalog()
  assert.equal(document.querySelectorAll('#items li').length, CHANNEL_CARD_PAGE)
  const list = document.getElementById('items')
  assert.equal(typeof list.onscroll, 'function')
})

function fakeScroller(list, { clientHeight, scrollHeight, scrollTop }) {
  Object.defineProperty(list, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(list, 'scrollHeight', { configurable: true, value: scrollHeight })
  list.scrollTop = scrollTop
}

test('scroll sem overflow não pinta o resto da lista ao vivo', () => {
  const { shell } = liveTodos(80)
  state.shell = shell
  state.channelLayout = 'list'
  renderCatalog()
  const list = document.getElementById('items')
  fakeScroller(list, { clientHeight: 800, scrollHeight: 800, scrollTop: 0 })
  list.onscroll()
  assert.equal(document.querySelectorAll('#items li').length, CHANNEL_CARD_PAGE)
})

test('scroll perto do fim pinta a próxima página da lista ao vivo', () => {
  const { shell } = liveTodos(80)
  state.shell = shell
  state.channelLayout = 'list'
  renderCatalog()
  const list = document.getElementById('items')
  fakeScroller(list, { clientHeight: 400, scrollHeight: 1200, scrollTop: 900 })
  list.onscroll()
  assert.equal(document.querySelectorAll('#items li').length, 80)
})

test('listagem ao vivo usa o índice xmltv por canal', () => {
  const channel = faker.string.alpha(6)
  const title = faker.word.words(3)
  const first = { id: 521, name: 'ESPN 1 HD', icon: '', epgChannelId: channel }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'live',
    catalog: { kind: 'live', categories: [{ id: '1', name: 'Esportes', items: [first] }] },
    selectedItem: first,
  }
  state.guide = {
    programs: [],
    byChannel: indexProgramsByChannel([
      {
        channelId: channel,
        start: '20261030180000 +0000',
        stop: '20261030220000 +0000',
        title,
      },
    ]),
    now: Date.UTC(2026, 9, 30, 19, 0, 0),
  }
  renderCatalog()
  assert.equal(document.querySelector('#items li').textContent.includes(title), true)
})

test('listagem ao vivo mostra o programa xmltv no ar', () => {
  const channel = faker.string.alpha(6)
  const title = faker.word.words(3)
  const first = { id: 521, name: 'ESPN 1 HD', icon: '', epgChannelId: channel }
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'live',
    catalog: { kind: 'live', categories: [{ id: '1', name: 'Esportes', items: [first] }] },
    selectedItem: first,
  }
  state.guide = {
    programs: [
      {
        channelId: channel,
        start: '20261030180000 +0000',
        stop: '20261030220000 +0000',
        title,
      },
    ],
    now: Date.UTC(2026, 9, 30, 19, 0, 0),
  }
  renderCatalog()
  assert.equal(document.querySelector('#items li').textContent.includes(title), true)
})

test('Filmes mostra o botão de Cards', () => {
  const { categories, first } = moviesCatalog()
  state.shell = {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: 'movies',
    catalog: { kind: 'movies', categories },
    selectedItem: first,
  }
  renderCatalog()
  assert.equal(document.querySelector('[data-channel-layout]').textContent.trim(), 'Cards')
})

function vodShell(kind, categories, selected) {
  return {
    ...createTvShell(),
    screen: 'catalog',
    catalogKind: kind,
    catalog: { kind, categories },
    selectedItem: selected,
  }
}

test('catálogo de filmes põe categorias à esquerda e títulos à direita', () => {
  const first = { id: faker.number.int({ min: 10, max: 99 }), name: 'Alfa', icon: '' }
  const second = { id: faker.number.int({ min: 100, max: 199 }), name: 'Beta', icon: '' }
  const action = { id: '1', name: 'Ação', items: [first] }
  const drama = { id: '2', name: 'Drama', items: [second] }
  state.shell = vodShell('movies', [action, drama], first)
  renderCatalog()

  assert.match(document.getElementById('catalog-grid').className, /grid-cols-\[18rem/)
  assert.match(document.getElementById('categories').className, /flex-col/)
  assert.match(document.getElementById('items').className, /flex-col/)
  assert.match(document.getElementById('detail').className, /hidden/)
  assert.equal(document.getElementById('shelf').childNodes.length, 0)

  const cats = document.querySelectorAll('#categories li')
  assert.equal(cats.length, 3)
  assert.match(cats[0].textContent, /Todos/)
  assert.match(cats[0].textContent, /2/)
  assert.match(cats[0].className, /w-full/)
  assert.equal(document.querySelectorAll('#items li').length, 2)
  assert.equal(document.querySelector('[data-list-fav]').dataset.listFav, String(first.id))
  const toggle = document.querySelector('[data-channel-layout]')
  assert.equal(toggle.textContent.trim(), 'Cards')
  setRedraw(renderCatalog)
  cats[2].click()
  assert.equal(state.shell.categoryIndex, 2)
  assert.equal(state.shell.selectedItem.name, 'Beta')
  assert.match(document.querySelector('#items li').textContent, /Beta/)
})

test('catálogo de séries usa a mesma listagem do ao vivo', () => {
  const episode = { id: faker.number.int({ min: 10, max: 99 }), name: 'Gama', icon: '' }
  state.shell = vodShell('series', [{ id: '1', name: 'Drama', items: [episode] }], episode)
  renderCatalog()
  assert.match(document.getElementById('catalog-grid').className, /grid-cols-\[18rem/)
  assert.match(document.getElementById('detail').className, /hidden/)
  assert.match(document.querySelector('#categories li').textContent, /Todos/)
  assert.equal(document.querySelector('[data-list-fav]').dataset.listFav, String(episode.id))
  assert.equal(document.querySelector('[data-channel-layout]').textContent.trim(), 'Cards')
  setRedraw(renderCatalog)
  document.querySelector('[data-channel-layout]').click()
  assert.equal(state.channelLayout, 'card')
  assert.match(document.getElementById('items').className, /flex-wrap/)
})
