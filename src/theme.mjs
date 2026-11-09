export const THEME_DARK = 'dark'
export const THEME_LIGHT = 'light'
export const THEMES = [THEME_DARK, THEME_LIGHT]
export const DEFAULT_THEME = THEME_DARK

/** Aceita só dark|light. */
export function normalizeTheme(value) {
  const theme = String(value ?? '').trim()
  if (THEMES.includes(theme)) return theme
  throw new Error(`tema recusado: recebido ${JSON.stringify(value)}, esperado dark|light`)
}

/** Storage corrompido ou vazio volta pro cinema escuro. */
export function parseStoredTheme(value) {
  try {
    return normalizeTheme(value)
  } catch {
    return DEFAULT_THEME
  }
}

/** Alterna entre os dois modos. */
export function nextTheme(current) {
  return normalizeTheme(current) === THEME_DARK ? THEME_LIGHT : THEME_DARK
}

/** Rótulo do clique: o modo que o botão vai ligar. */
export function themeButtonLabel(theme) {
  return normalizeTheme(theme) === THEME_DARK ? 'Modo claro' : 'Modo escuro'
}

/** Sol no escuro (ir pro claro), lua no claro. */
export function themeGlyph(theme) {
  return normalizeTheme(theme) === THEME_DARK ? 'sun' : 'moon'
}

function readTheme(bucket) {
  return parseStoredTheme(bucket?.read()?.theme)
}

/** Prefs de claro/escuro num bucket JSON. */
export function createThemeStore({ bucket = null } = {}) {
  let theme = readTheme(bucket)
  function persist() {
    bucket?.write({ theme })
  }
  return {
    hydrate() {
      theme = readTheme(bucket)
      return theme
    },
    get() {
      return theme
    },
    set(next) {
      theme = normalizeTheme(next)
      persist()
      return theme
    },
    toggle() {
      return this.set(nextTheme(theme))
    },
  }
}
