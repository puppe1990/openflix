import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

const { openYoutubeSignIn } = await import('../web/youtubeWindow.mjs')

beforeEach(() => {
  delete globalThis.__TAURI__
})

test('openYoutubeSignIn no preview abre o YouTube no navegador', async () => {
  const opened = []
  globalThis.open = (url, target) => {
    opened.push({ url, target })
    return null
  }
  const ok = await openYoutubeSignIn()
  assert.equal(ok, false)
  assert.deepEqual(opened, [{ url: 'https://www.youtube.com', target: '_blank' }])
})

test('openYoutubeSignIn no Tauri abre o Google e espera o auth_check', async () => {
  const calls = []
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command) => {
        calls.push(command)
        if (command === 'youtube_sign_in') return
        if (command === 'youtube_auth_check') {
          return calls.filter((name) => name === 'youtube_auth_check').length < 2
            ? 'pending'
            : 'authorized'
        }
        throw new Error(`comando inesperado ${command}`)
      },
    },
  }
  const ok = await openYoutubeSignIn({ sleep: async () => {} })
  assert.equal(ok, true)
  assert.deepEqual(calls, ['youtube_sign_in', 'youtube_auth_check', 'youtube_auth_check'])
})

test('openYoutubeSignIn recusa se a janela fechar antes do login', async () => {
  globalThis.__TAURI__ = {
    core: {
      invoke: async (command) => {
        if (command === 'youtube_sign_in') return
        if (command === 'youtube_auth_check') return 'no_window'
        throw new Error(`comando inesperado ${command}`)
      },
    },
  }
  await assert.rejects(
    () => openYoutubeSignIn({ sleep: async () => {} }),
    /youtube recusou: recebido janela fechada, esperado login concluído/,
  )
})
