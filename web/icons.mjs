/** SVG de linha única, cor via currentColor. */
export function iconSvg(d, size = 18) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('fill', 'currentColor')
  svg.setAttribute('aria-hidden', 'true')
  svg.classList.add('shrink-0')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', d)
  svg.append(path)
  return svg
}

export const ICON_PLAY = 'M8 5v14l11-7z'
export const ICON_PAUSE = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'
export const ICON_BACK = 'M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z'
export const ICON_SKIP_BACK =
  'M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C23.22 11.27 18.29 8 12.5 8z'
export const ICON_SKIP_FORWARD =
  'M11.5 18c2.65 0 5.05-.99 6.9-2.6L22 19V10h-9l3.62 3.62c-1.39 1.16-3.16 1.88-5.12 1.88-3.54 0-6.55-2.31-7.6-5.5l-2.37.78C.78 14.73 5.71 18 11.5 18z'
export const ICON_VOLUME =
  'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z'
export const ICON_FULLSCREEN =
  'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z'
export const ICON_GRID = 'M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z'
export const ICON_LIST = 'M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z'
export const ICON_HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z'
