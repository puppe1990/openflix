import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { faker } from './factories.mjs'
import {
  CASA_DOCK,
  callHouse,
  casaClock,
  casaHero,
  casaRails,
  createCasaShell,
  handleCasaKey,
  shouldLeaveToCasa,
  visibleDock,
} from '../src/casa.mjs'

beforeEach(() => {
  faker.seed(110)
})

function card(overrides = {}) {
  return {
    streamId: String(faker.number.int({ min: 1000, max: 99_999 })),
    name: faker.company.name(),
    catalogKind: 'live',
    icon: '',
    ...overrides,
  }
}

test('herói usa o último do histórico como Continuar', () => {
  const last = card({ name: 'A Fazenda 18' })
  const hero = casaHero({ history: [last, card()], favs: [] })
  assert.equal(hero.kind, 'resume')
  assert.equal(hero.kicker, 'CONTINUAR')
  assert.equal(hero.name, 'A Fazenda 18')
  assert.equal(hero.card.streamId, last.streamId)
})

test('herói cai no favorito quando o histórico está vazio', () => {
  const fav = card({ name: 'ESPN 1 HD' })
  const hero = casaHero({ history: [], favs: [fav] })
  assert.equal(hero.kind, 'featured')
  assert.equal(hero.name, 'ESPN 1 HD')
})

test('herói frio quando não há histórico nem favorito', () => {
  const hero = casaHero({ history: [], favs: [] })
  assert.equal(hero.kind, 'cold')
  assert.equal(hero.name, 'OpenFlix')
  assert.equal(hero.card, null)
})

test('relógio da Casa usa Brasília mesmo se o Date estiver em UTC', () => {
  const utcNoon = new Date('2026-11-10T15:00:00.000Z')
  assert.equal(casaClock(utcNoon), '12:00')
})

test('trilho Continuar é o histórico e Recomendados usa favoritos', () => {
  const history = [card({ name: 'A' }), card({ name: 'B' })]
  const favs = [card({ name: 'Fav' })]
  const rails = casaRails({ history, favs })
  assert.equal(rails.continueRow[0].name, 'A')
  assert.equal(rails.recommended[0].name, 'Fav')
})

test('Recomendados cai no restante do histórico se não há favorito', () => {
  const history = [card({ name: 'A' }), card({ name: 'B' })]
  const rails = casaRails({ history, favs: [] })
  assert.equal(rails.recommended[0].name, 'B')
})

test('dock esconde pacote ausente e HDMI sem intent', () => {
  const dock = visibleDock({
    packages: ['com.google.android.youtube.tv', 'com.android.vending'],
    hdmi: false,
  })
  assert.deepEqual(
    dock.map((item) => item.id),
    ['openflix', 'youtube', 'netflix', 'prime', 'play', 'apps'],
  )
})

test('dock inclui HDMI quando o QuickShare está instalado', () => {
  const dock = visibleDock({
    packages: [
      'com.google.android.youtube.tv',
      'com.android.vending',
      'com.rockchips.mediacenter',
      'com.android.tv.settings',
      'com.bozee.usbdisplay',
    ],
    hdmi: false,
  })
  assert.deepEqual(
    dock.map((item) => item.id),
    ['openflix', 'youtube', 'netflix', 'prime', 'play', 'hdmi', 'files', 'settings', 'apps'],
  )
  const hdmi = dock.find((item) => item.id === 'hdmi')
  assert.equal(hdmi.action.type, 'package')
  assert.equal(hdmi.action.package, 'com.bozee.usbdisplay')
  assert.equal(CASA_DOCK.length, 9)
})

test('dock mostra Netflix mesmo sem o pacote', () => {
  const dock = visibleDock({ packages: [], hdmi: false })
  const netflix = dock.find((item) => item.id === 'netflix')
  assert.equal(netflix.action.package, 'com.netflix.mediaclient')
  assert.equal(netflix.icon, './casa-icons/netflix.png')
})

test('Enter no Netflix do dock pede o pacote', () => {
  const dock = visibleDock({ packages: [], hdmi: false })
  const netflixAt = dock.findIndex((item) => item.id === 'netflix')
  const result = handleCasaKey(
    { ...createCasaShell(), zone: 'dock', dockIndex: netflixAt },
    'Enter',
    { dock, rails: casaRails({}), hero: casaHero({}) },
  )
  assert.equal(result.action.type, 'package')
  assert.equal(result.action.package, 'com.netflix.mediaclient')
})

test('foco inicial no herói e D-pad desce até o dock', () => {
  const dock = visibleDock({
    packages: ['com.google.android.youtube.tv'],
    hdmi: false,
  })
  const rails = casaRails({ history: [card(), card()], favs: [] })
  let shell = createCasaShell()
  assert.equal(shell.zone, 'hero')
  shell = handleCasaKey(shell, 'ArrowDown', { rails, dock }).shell
  assert.equal(shell.zone, 'rails')
  assert.equal(shell.railIndex, 0)
  shell = handleCasaKey(shell, 'ArrowDown', { rails, dock }).shell
  assert.equal(shell.zone, 'rails')
  assert.equal(shell.railIndex, 1)
  shell = handleCasaKey(shell, 'ArrowDown', { rails, dock }).shell
  assert.equal(shell.zone, 'dock')
})

test('D-pad no dock cicla os ícones visíveis', () => {
  const dock = visibleDock({
    packages: ['com.google.android.youtube.tv', 'com.android.vending'],
    hdmi: false,
  })
  let shell = { ...createCasaShell(), zone: 'dock', dockIndex: 0 }
  shell = handleCasaKey(shell, 'ArrowRight', { dock, rails: casaRails({}) }).shell
  assert.equal(shell.dockIndex, 1)
  assert.equal(dock[shell.dockIndex].id, 'youtube')
})

test('Enter no herói com resume lança o OpenFlix naquele título', () => {
  const last = card({ name: 'A Fazenda 18' })
  const hero = casaHero({ history: [last], favs: [] })
  const result = handleCasaKey(createCasaShell(), 'Enter', {
    hero,
    rails: casaRails({ history: [last] }),
    dock: visibleDock({ packages: [], hdmi: false }),
  })
  assert.equal(result.action.type, 'openflix')
  assert.equal(result.action.play, last.streamId)
})

test('Enter no YouTube do dock pede o pacote da TV', () => {
  const dock = visibleDock({
    packages: ['com.google.android.youtube.tv'],
    hdmi: false,
  })
  const youtubeAt = dock.findIndex((item) => item.id === 'youtube')
  const result = handleCasaKey(
    { ...createCasaShell(), zone: 'dock', dockIndex: youtubeAt },
    'Enter',
    { dock, rails: casaRails({}), hero: casaHero({}) },
  )
  assert.equal(result.action.type, 'package')
  assert.equal(result.action.package, 'com.google.android.youtube.tv')
})

test('Escape na Casa fecha a gaveta Apps e senão fica', () => {
  const model = {
    hero: casaHero({}),
    rails: casaRails({}),
    dock: visibleDock({ packages: [], hdmi: false }),
  }
  const fromApps = handleCasaKey({ ...createCasaShell(), zone: 'apps' }, 'Escape', model)
  assert.equal(fromApps.shell.zone, 'hero')
  assert.equal(fromApps.action, null)
  const stay = handleCasaKey(createCasaShell(), 'Escape', model)
  assert.equal(stay.shell.zone, 'hero')
  assert.equal(stay.action, null)
})

test('Escape no Início do OpenFlix volta para a Casa', () => {
  assert.equal(shouldLeaveToCasa({ screen: 'home' }, 'Escape'), true)
  assert.equal(shouldLeaveToCasa({ screen: 'player' }, 'Escape'), false)
  assert.equal(shouldLeaveToCasa({ screen: 'home' }, 'ArrowLeft'), false)
})

test('callHouse chama o método no objeto injetado', () => {
  const house = {
    launch(raw) {
      assert.equal(this, house)
      return `ok:${raw}`
    },
  }
  globalThis.OpenFlixHouse = house
  try {
    assert.equal(callHouse('launch', '{"type":"openflix"}'), 'ok:{"type":"openflix"}')
  } finally {
    delete globalThis.OpenFlixHouse
  }
})

test('callHouse sem ponte devolve undefined', () => {
  delete globalThis.OpenFlixHouse
  assert.equal(callHouse('launch', '{}'), undefined)
})

test('Enter no trilho lança o cartão focado', () => {
  const first = card({ name: 'ESPN 2 HD' })
  const second = card({ name: 'A Fazenda 18' })
  const rails = casaRails({ history: [first, second], favs: [] })
  const result = handleCasaKey({ ...createCasaShell(), zone: 'rails', railItem: 0 }, 'Enter', {
    hero: casaHero({ history: [first] }),
    rails,
    dock: visibleDock({ packages: [], hdmi: false }),
  })
  assert.equal(result.action.type, 'openflix')
  assert.equal(result.action.play, first.streamId)
})

test('Down no Continuar vai para Recomendados e só depois o dock', () => {
  const fav = card({ name: 'SporTV 1 HD' })
  const rails = casaRails({ history: [card(), card(), card()], favs: [fav] })
  const dock = visibleDock({ packages: ['com.google.android.youtube.tv'], hdmi: false })
  let shell = { ...createCasaShell(), zone: 'rails', railIndex: 0, railItem: 2 }
  shell = handleCasaKey(shell, 'ArrowDown', { rails, dock }).shell
  assert.equal(shell.zone, 'rails')
  assert.equal(shell.railIndex, 1)
  assert.equal(shell.railItem, 0)
  shell = handleCasaKey(shell, 'ArrowDown', { rails, dock }).shell
  assert.equal(shell.zone, 'dock')
})

test('Enter no Recomendados lança o cartão daquele trilho', () => {
  const fav = card({ name: 'SporTV 1 HD' })
  const rails = casaRails({ history: [card()], favs: [fav] })
  const result = handleCasaKey(
    { ...createCasaShell(), zone: 'rails', railIndex: 1, railItem: 0 },
    'Enter',
    {
      hero: casaHero({}),
      rails,
      dock: visibleDock({ packages: [], hdmi: false }),
    },
  )
  assert.equal(result.action.type, 'openflix')
  assert.equal(result.action.play, fav.streamId)
})
