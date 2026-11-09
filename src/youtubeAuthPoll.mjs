/** Espera o webview do Google gravar SAPISID (OurTube auth_check). */
export async function waitYoutubeAuth({ check, sleep, maxTries = 90 }) {
  if (typeof check !== 'function') {
    throw new Error('youtube recusou: recebido check ausente, esperado função de auth_check')
  }
  const tries = Number(maxTries)
  if (!Number.isInteger(tries) || tries < 1) {
    throw new Error(`youtube recusou: recebido maxTries ${maxTries}, esperado inteiro >= 1`)
  }
  for (let attempt = 0; attempt < tries; attempt += 1) {
    const status = await check()
    if (status === 'authorized') return 'authorized'
    if (status === 'no_window') {
      throw new Error('youtube recusou: recebido janela fechada, esperado login concluído')
    }
    if (attempt < tries - 1 && typeof sleep === 'function') await sleep()
  }
  throw new Error('youtube recusou: recebido login pendente, esperado conta Google autorizada')
}
