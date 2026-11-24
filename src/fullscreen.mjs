/** Rótulo do botão de tela cheia. */
export function fullscreenButtonLabel(active) {
  if (typeof active !== 'boolean') {
    throw new Error(`active recusado: recebido ${JSON.stringify(active)}, esperado boolean`)
  }
  return active ? 'Sair da tela cheia' : 'Tela cheia'
}

/** Esc sai da tela cheia em vez de voltar o shell. No projetor Voltar já sai do player. */
export function shouldConsumeEscape(active, { leanback } = {}) {
  if (leanback === true) return false
  return active === true
}
