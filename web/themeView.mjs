import { themeButtonLabel, themeGlyph } from '../src/theme.mjs'
import { themeToggleClass } from '../src/tvSkin.mjs'
import { ICON_MOON, ICON_SUN, iconSvg } from './icons.mjs'

const GLYPH = { sun: ICON_SUN, moon: ICON_MOON }

/** Aplica data-theme e color-scheme no <html>. */
export function applyThemeDocument(root, theme) {
  if (!root) return
  root.dataset.theme = theme
  root.style.colorScheme = theme
}

function paintThemeButton(button, theme) {
  if (!button) return
  button.className = themeToggleClass()
  button.setAttribute('aria-label', themeButtonLabel(theme))
  button.title = themeButtonLabel(theme)
  button.replaceChildren(iconSvg(GLYPH[themeGlyph(theme)], 20))
}

function syncTheme(root, button, store) {
  const theme = store.get()
  applyThemeDocument(root, theme)
  paintThemeButton(button, theme)
}

/** Liga o botão do header ao store e pinta o estado atual. */
export function wireThemeToggle({ store, button, root }) {
  if (!store || !button) return
  syncTheme(root, button, store)
  button.addEventListener('click', () => {
    store.toggle()
    syncTheme(root, button, store)
  })
}
