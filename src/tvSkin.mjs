const TILE_BASE =
  'relative overflow-hidden rounded-lg bg-panel text-left cursor-pointer min-h-[120px] p-4 md:min-h-[160px] md:p-6 font-display text-[clamp(18px,1.6vw,28px)] font-bold transition-colors ring-1 ring-white/10'

const ITEM_BASE =
  'flex items-center gap-3 rounded-lg p-3 md:p-3 cursor-pointer bg-panel text-ink ring-1 ring-transparent'

const CHIP_BASE =
  'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 font-sans text-[12px] font-bold tracking-[0.04em]'

/** Classes Tailwind 10-foot. Literais inteiras pro scanner do CLI. */
export function tileClass(selected) {
  if (selected) {
    return `${TILE_BASE} ring-2 ring-accent bg-row text-ink`
  }
  return `${TILE_BASE} text-ink`
}

export function itemClass(selected) {
  if (selected) {
    return `${ITEM_BASE} ring-accent bg-row`
  }
  return ITEM_BASE
}

export function playerUrlClass() {
  return 'mt-4 block break-all text-[clamp(12px,0.9vw,16px)] text-mute'
}

function listingKind(kind) {
  return kind === 'live' || kind === 'movies' || kind === 'series'
}

export function catalogGridClass(kind) {
  if (listingKind(kind)) {
    return 'grid h-[calc(100vh-8rem)] min-h-0 grid-cols-[18rem_minmax(0,1fr)] grid-rows-[minmax(0,1fr)] items-stretch gap-4 overflow-hidden'
  }
  return 'grid grid-cols-1 items-start gap-6 xl:grid-cols-12'
}

export function catalogDetailClass(kind) {
  if (listingKind(kind)) return 'hidden'
  return 'min-w-0 xl:col-span-7'
}

export function catalogListsClass(kind) {
  if (listingKind(kind)) return 'contents'
  return 'flex min-w-0 flex-col gap-3 xl:col-span-5'
}

export function catListClass(kind) {
  if (listingKind(kind)) {
    return 'm-0 flex h-full min-h-0 list-none flex-col gap-1 overflow-y-auto p-0'
  }
  return 'm-0 flex list-none flex-nowrap gap-2 overflow-x-auto p-0'
}

export function itemListClass(kind, layout = 'list') {
  if (listingKind(kind) && layout === 'card') {
    return 'm-0 flex min-h-0 min-w-0 w-full flex-1 list-none flex-wrap content-start gap-3 overflow-y-auto p-0'
  }
  if (listingKind(kind)) {
    return 'm-0 flex min-h-0 min-w-0 w-full flex-1 list-none flex-col gap-2 overflow-y-auto p-0'
  }
  return 'm-0 flex min-h-0 max-h-[70vh] list-none flex-col gap-2 overflow-y-auto p-0'
}

export function itemCardClass(selected) {
  const base =
    'flex w-[calc((100%-1.5rem)/3)] min-w-0 cursor-pointer flex-col overflow-hidden rounded-lg bg-panel text-left ring-1 ring-transparent xl:w-[calc((100%-2.25rem)/4)]'
  if (selected) return `${base} ring-accent bg-row`
  return base
}

export function itemsPaneClass(kind) {
  if (listingKind(kind)) return 'flex h-full min-h-0 min-w-0 w-full flex-col gap-2 overflow-hidden'
  return 'flex min-h-0 flex-col gap-2'
}

export function catItemClass(selected = false, kind = 'movies') {
  if (listingKind(kind)) {
    const base =
      'flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2.5 font-sans text-[13px] font-bold'
    if (selected) return `${base} bg-accent text-ink`
    return `${base} bg-panel text-mute`
  }
  if (selected) {
    return `${CHIP_BASE} bg-accent text-ink`
  }
  return `${CHIP_BASE} bg-panel text-mute`
}

export function catCountClass() {
  return 'text-[clamp(11px,0.8vw,14px)] text-mute'
}

export function playerTitleClass() {
  return 'm-0 mb-2 font-display text-[clamp(22px,2.2vw,40px)] font-bold tracking-tight'
}

export function playerNoteClass() {
  return 'm-0 text-[clamp(14px,1vw,18px)] text-mute'
}

export function tabClass(active) {
  if (active) {
    return 'cursor-pointer border-0 bg-transparent p-0 font-sans text-[clamp(14px,1vw,18px)] font-bold text-ink'
  }
  return 'cursor-pointer border-0 bg-transparent p-0 font-sans text-[clamp(14px,1vw,18px)] text-mute'
}

export function actionClass() {
  return 'inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-action px-4 py-2 font-sans text-[clamp(14px,1vw,16px)] font-bold text-void md:px-5 md:py-2.5'
}

export function ghostClass() {
  return 'inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-row px-4 py-2 font-sans text-[clamp(14px,1vw,16px)] font-bold text-ink md:px-5 md:py-2.5'
}

export function playlistChipClass(selected) {
  if (selected) {
    return 'cursor-pointer rounded-lg border-0 bg-accent px-4 py-2 font-sans text-[clamp(14px,1vw,16px)] font-bold text-ink'
  }
  return 'cursor-pointer rounded-lg border-0 bg-panel px-4 py-2 font-sans text-[clamp(14px,1vw,16px)] text-ink'
}

export function primeChipClass(active) {
  const base =
    'cursor-pointer rounded-lg border-0 px-4 py-2 font-sans text-[clamp(13px,0.95vw,16px)] font-bold'
  return active ? `${base} bg-accent text-ink` : `${base} bg-row text-mute`
}

export function liveBadgeClass() {
  return 'inline-flex w-fit items-center gap-1.5 rounded bg-accent px-2 py-1 font-sans text-[10px] font-bold tracking-[0.06em] text-ink uppercase'
}

export function favToggleClass(on, overlay = false) {
  if (overlay) {
    const base =
      'absolute right-2 bottom-2 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-black/60'
    return on ? `${base} text-accent` : `${base} text-ink`
  }
  const base =
    'inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent'
  return on ? `${base} text-accent` : `${base} text-mute`
}
