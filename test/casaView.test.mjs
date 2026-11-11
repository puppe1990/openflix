import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import { faker } from './factories.mjs'
import { casaHero, casaRails, createCasaShell, visibleDock } from '../src/casa.mjs'

const dom = new JSDOM('<!doctype html><body></body>')
globalThis.document = dom.window.document

const { renderCasa } = await import('../web/casaView.mjs')

beforeEach(() => {
  faker.seed(111)
})

test('pinta o herói e o OpenFlix no dock', () => {
  const card = {
    streamId: '42',
    name: 'A Fazenda 18',
    catalogKind: 'live',
    icon: '',
  }
  const root = document.createElement('div')
  renderCasa(root, {
    shell: createCasaShell(),
    hero: casaHero({ history: [card], favs: [] }),
    rails: casaRails({ history: [card], favs: [] }),
    dock: visibleDock({ packages: [], hdmi: false }),
    clock: '19:03',
    toast: null,
    apps: [],
  })
  assert.match(root.textContent, /A Fazenda 18/)
  assert.match(root.textContent, /Assistir agora/)
  assert.ok(root.querySelector('[data-dock="openflix"]'))
  assert.equal(
    root.querySelector('[data-dock="openflix"] img.casa-dot-icon')?.getAttribute('src'),
    './casa-icons/openflix.png',
  )
  assert.equal(
    root.querySelector('[data-dock="netflix"] img.casa-dot-icon')?.getAttribute('src'),
    './casa-icons/netflix.png',
  )
  assert.ok(root.querySelector('[data-zone="hero"].is-focus'))
})

test('pinta o poster no herói e no cartão quando o retrato tem icon', () => {
  const icon = `https://cdn.${faker.internet.domainName()}/espn.png`
  const card = {
    streamId: '19',
    name: 'ESPN 2 HD',
    catalogKind: 'live',
    icon,
  }
  const root = document.createElement('div')
  renderCasa(root, {
    shell: createCasaShell(),
    hero: casaHero({ history: [card], favs: [] }),
    rails: casaRails({ history: [card], favs: [] }),
    dock: visibleDock({ packages: [], hdmi: false }),
    clock: '23:08',
    toast: null,
    apps: [],
  })
  const hero = root.querySelector('[data-zone="hero"]')
  assert.match(hero?.getAttribute('style') || '', /espn\.png/)
  const art = root.querySelector('[data-rail="0"] .casa-card-art')
  assert.match(art?.getAttribute('style') || '', /espn\.png/)
  assert.match(root.querySelector('[data-rail="0"] .casa-card-name')?.textContent, /ESPN 2 HD/)
})

test('pinta ícone de Prime e Play no dock', () => {
  const root = document.createElement('div')
  renderCasa(root, {
    shell: createCasaShell(),
    hero: casaHero({}),
    rails: casaRails({}),
    dock: visibleDock({ packages: ['com.android.vending'], hdmi: false }),
    clock: '23:08',
    toast: null,
    apps: [],
  })
  assert.equal(
    root.querySelector('[data-dock="prime"] img.casa-dot-icon')?.getAttribute('src'),
    './casa-icons/prime.png',
  )
  assert.equal(
    root.querySelector('[data-dock="play"] img.casa-dot-icon')?.getAttribute('src'),
    './casa-icons/play.png',
  )
})

test('pinta o foco no cartão de Recomendados', () => {
  const live = {
    streamId: '1',
    name: 'ESPN 2 HD',
    catalogKind: 'live',
    icon: '',
  }
  const fav = {
    streamId: '2',
    name: 'SporTV 1 HD',
    catalogKind: 'live',
    icon: '',
  }
  const root = document.createElement('div')
  renderCasa(root, {
    shell: { ...createCasaShell(), zone: 'rails', railIndex: 1, railItem: 0 },
    hero: casaHero({ history: [live], favs: [fav] }),
    rails: casaRails({ history: [live], favs: [fav] }),
    dock: visibleDock({ packages: [], hdmi: false }),
    clock: '22:29',
    toast: null,
    apps: [],
  })
  const recommended = root.querySelector('[data-rail="1"] .casa-card.is-focus')
  assert.equal(recommended?.querySelector('.casa-card-name')?.textContent, 'SporTV 1 HD')
  assert.equal(root.querySelector('[data-rail="0"] .casa-card.is-focus'), null)
})
