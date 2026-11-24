/** Ponte Java `OpenFlixHouse` só existe no APK do projetor. */
export function isLeanbackApp(house = globalThis.OpenFlixHouse) {
  return house != null && typeof house === 'object'
}

/** No HY300 o play já abre o teatro, como o YouTube TV. */
export function shouldEnterPlayerFullscreen({ leanback, screen } = {}) {
  return leanback === true && screen === 'player'
}
