//! Diagnóstico do player nativo do Prime: cada passo do caminho (pane, captura,
//! EME, licença, vídeo) vira uma linha no `prime-oracle.jsonl` do shell. O log é
//! local e só serve para investigar reprodução; no preview web não faz nada.

import { tauriInvoke } from './bridge.mjs'

/** Registra um passo do caminho nativo no log do oráculo. */
export function primeTrace(step, extra = {}) {
  const invoke = tauriInvoke()
  if (!invoke) return
  const payload = JSON.stringify({ kind: 'native', at: Date.now(), step, ...extra })
  void invoke('prime_oracle_report', { payload }).catch(() => {})
}
