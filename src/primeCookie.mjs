/** Normaliza o header Cookie colado (tira prefixo e espaços). */
export function normalizePrimeCookie(raw) {
  const stripped = String(raw ?? '')
    .trim()
    .replace(/^cookie:\s*/i, '')
  if (!stripped) {
    throw new Error('cookie recusado: recebido vazio, esperado pares name=value')
  }
  if (!stripped.includes('=')) {
    throw new Error(`cookie recusado: recebido ${stripped.slice(0, 40)}, esperado pares name=value`)
  }
  return stripped
}
