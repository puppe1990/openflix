import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

async function readRepo(relative) {
  return readFile(new URL(`../${relative}`, import.meta.url), 'utf8')
}

test('versão 0.2.0 é a mesma no npm, Cargo e Tauri', async () => {
  const pkg = JSON.parse(await readRepo('package.json'))
  const tauri = JSON.parse(await readRepo('src-tauri/tauri.conf.json'))
  const cargo = await readRepo('src-tauri/Cargo.toml')
  assert.equal(pkg.version, '0.2.0')
  assert.equal(tauri.version, '0.2.0')
  assert.match(cargo, /^version = "0\.2\.0"$/m)
})

test('bundle Tauri gera instaladores e o frontend dist', async () => {
  const tauri = JSON.parse(await readRepo('src-tauri/tauri.conf.json'))
  assert.equal(tauri.bundle.active, true)
  for (const icon of [
    'icons/32x32.png',
    'icons/128x128.png',
    'icons/128x128@2x.png',
    'icons/icon.icns',
    'icons/icon.ico',
  ]) {
    assert.ok(tauri.bundle.icon.includes(icon), `ícone ausente: ${icon}`)
  }
  assert.match(tauri.build.beforeBuildCommand, /tauri:dist/)
})

test('Info.plist do bundle libera HTTP e loopback', async () => {
  const plist = await readRepo('src-tauri/Info.plist')
  assert.match(plist, /NSAppTransportSecurity/)
  assert.match(plist, /<key>NSAllowsArbitraryLoads<\/key>/)
  assert.match(plist, /NSAllowsArbitraryLoadsForMedia/)
  assert.match(plist, /NSAllowsArbitraryLoadsInWebContent/)
  assert.match(plist, /NSAllowsLocalNetworking/)
})

test('make-icons.sh gera PNG, icns e ico das três plataformas', async () => {
  const script = await readRepo('scripts/make-icons.sh')
  assert.match(script, /32x32\.png/)
  assert.match(script, /128x128\.png/)
  assert.match(script, /128x128@2x\.png/)
  assert.match(script, /icon\.ico/)
})

test('CI cargo cria o frontendDist antes de generate_context', async () => {
  const yml = await readRepo('.github/workflows/ci.yml')
  const cargoAt = yml.indexOf('cargo test --manifest-path src-tauri/Cargo.toml --bins')
  const stubAt = yml.indexOf('.tauri-dist/web')
  assert.notEqual(stubAt, -1)
  assert.notEqual(cargoAt, -1)
  assert.ok(stubAt < cargoAt, 'mkdir do dist precisa vir antes do cargo test')
})

test('release.yml empacota Mac, Windows e Linux na tag', async () => {
  const yml = await readRepo('.github/workflows/release.yml')
  assert.match(yml, /tags:\s*\n\s*-\s*'v\*'/m)
  assert.match(yml, /macos-latest/)
  assert.match(yml, /windows-latest/)
  assert.match(yml, /ubuntu-22\.04/)
  assert.match(yml, /tauri-apps\/tauri-action/)
  assert.match(yml, /aarch64-apple-darwin/)
  assert.match(yml, /x86_64-apple-darwin/)
})
