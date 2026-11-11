/** Política de volume do APK HY300. O Vol- do controle tem que ficar. */

export function shouldForceMaxVolume(reason) {
  return reason === 'start'
}

export function shouldConsumeVolumeKey(_code) {
  return false
}

/** Aplica o evento de volume. Se a política força o teto, devolve max. */
export function applyVolumeEvent({ streamVolume, max, reason }) {
  if (shouldForceMaxVolume(reason)) return { streamVolume: max }
  return { streamVolume }
}
