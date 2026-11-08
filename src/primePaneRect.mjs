/** Largura mínima do painel; abaixo disso o player oficial não desenha controle nenhum. */
export const PANE_MIN_WIDTH = 320
/** Altura mínima do painel, pelo mesmo motivo de `PANE_MIN_WIDTH`. */
export const PANE_MIN_HEIGHT = 180

function clamp(value, floor, ceiling) {
  return Math.min(Math.max(value, floor), ceiling)
}

function allFinite(values) {
  return values.every((value) => Number.isFinite(value))
}

/**
 * Converte o retângulo CSS do placeholder no retângulo lógico do painel nativo: recortado
 * para caber na janela e arredondado para px inteiro, que é o que o webview filho entende.
 *
 * Devolve `null` quando o que sobra é pequeno demais para o player oficial. Placeholder
 * oculto devolve tudo zero no DOM — nesse caso o painel tem que sumir, não ficar torto.
 *
 * @param {{left:number, top:number, width:number, height:number, right?:number, bottom?:number}} host
 * @param {{width:number, height:number}} viewport
 * @returns {{x:number, y:number, width:number, height:number} | null}
 */
export function paneRect(host, viewport) {
  if (!host || !viewport) return null
  const right = host.right ?? host.left + host.width
  const bottom = host.bottom ?? host.top + host.height
  const measures = [host.left, host.top, right, bottom, viewport.width, viewport.height]
  if (!allFinite(measures)) return null
  const x = Math.round(clamp(host.left, 0, viewport.width))
  const y = Math.round(clamp(host.top, 0, viewport.height))
  const width = Math.round(clamp(right, 0, viewport.width)) - x
  const height = Math.round(clamp(bottom, 0, viewport.height)) - y
  if (width < PANE_MIN_WIDTH || height < PANE_MIN_HEIGHT) return null
  return { x, y, width, height }
}
