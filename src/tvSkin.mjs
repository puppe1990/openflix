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

export function tabClass(active, focused = false) {
  if (focused) {
    return 'cursor-pointer shrink-0 whitespace-nowrap rounded-sm border-0 bg-accent px-1.5 py-1 font-sans text-[clamp(13px,1vw,18px)] font-bold text-ink ring-2 ring-accent xl:px-2'
  }
  if (active) {
    return 'cursor-pointer shrink-0 whitespace-nowrap rounded-sm border-0 bg-transparent px-1.5 py-1 font-sans text-[clamp(13px,1vw,18px)] font-bold text-ink xl:px-2'
  }
  return 'cursor-pointer shrink-0 whitespace-nowrap rounded-sm border-0 bg-transparent px-1.5 py-1 font-sans text-[clamp(13px,1vw,18px)] text-mute xl:px-2'
}

export function actionClass() {
  return 'inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-action px-4 py-2 font-sans text-[clamp(14px,1vw,16px)] font-bold text-void md:px-5 md:py-2.5'
}

export function ghostClass() {
  return 'inline-flex cursor-pointer items-center gap-2 rounded-lg border-0 bg-row px-4 py-2 font-sans text-[clamp(14px,1vw,16px)] font-bold text-ink md:px-5 md:py-2.5'
}

export function themeToggleClass() {
  return 'inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-row text-ink ring-1 ring-ink/20'
}

export function qualityPanelClass() {
  return 'absolute right-4 bottom-24 z-20 flex w-72 max-h-[70%] flex-col overflow-hidden rounded-lg bg-panel py-1 ring-1 ring-white/10'
}

export function hudOverlayClass() {
  return 'pointer-events-auto absolute inset-0 z-[5] flex flex-col justify-between bg-[linear-gradient(to_bottom,rgba(0,0,0,0.86)_0%,rgba(0,0,0,0.18)_26%,transparent_46%,rgba(0,0,0,0.28)_64%,rgba(0,0,0,0.92)_100%)] transition-opacity duration-300'
}

export function hudTopClass() {
  return 'pointer-events-auto flex items-start justify-between gap-4 px-6 pt-5'
}

export function hudTitleClass() {
  return 'm-0 font-display text-[clamp(26px,3.2vw,48px)] font-black tracking-tight text-white'
}

export function hudChipClass() {
  return 'inline-flex items-center rounded border border-white/20 bg-black/45 px-2 py-0.5 font-sans text-[10px] font-bold tracking-[0.08em] text-ink uppercase'
}

export function hudBrandClass() {
  return 'inline-flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 font-sans text-[11px] font-bold tracking-[0.16em] text-ink uppercase ring-1 ring-white/10'
}

export function hudPauseClass() {
  return 'pointer-events-auto flex h-[4.5rem] w-[4.5rem] cursor-pointer items-center justify-center rounded-2xl border-0 bg-black/55 text-white shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-sm'
}

export function hudIconBtnClass() {
  return 'pointer-events-auto inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-white'
}

export function hudToolbarClass() {
  return 'pointer-events-auto flex min-w-0 flex-wrap items-center gap-2'
}

export function hudClockClass() {
  return 'font-sans text-[13px] font-bold tracking-wide text-ink tabular-nums'
}

export function hudNextClass() {
  return 'inline-flex cursor-pointer items-center gap-2 rounded-full bg-black/65 px-4 py-2 font-sans text-[14px] font-bold text-white ring-1 ring-white/15'
}

export function hudVolumeClass() {
  return 'pointer-events-auto flex shrink-0 items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 ring-1 ring-white/20'
}

export function hudVolumeSliderClass() {
  return 'h-2 w-36 shrink-0 cursor-pointer appearance-none rounded-full bg-white/40'
}

export function hudVolumeLabelClass() {
  return 'min-w-10 font-sans text-[13px] font-bold tabular-nums text-white'
}

export function qualityListClass() {
  return 'flex max-h-[60vh] flex-col overflow-y-auto'
}

export function qualityHeadClass() {
  return 'flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-4 py-3 text-left font-sans text-[clamp(14px,1vw,16px)] font-bold text-ink'
}

export function qualityItemClass(selected) {
  const base =
    'flex w-full cursor-pointer items-center gap-2 border-0 px-4 py-3 text-left font-sans text-[clamp(14px,1vw,16px)] font-bold'
  if (selected) return `${base} bg-row text-ink`
  return `${base} bg-transparent text-ink`
}

export function settingsStageClass() {
  return 'grid min-h-[calc(100vh-8rem)] grid-cols-[13rem_minmax(0,1fr)] gap-6'
}

export function settingsRailClass(active) {
  const base =
    'flex w-full cursor-pointer items-center rounded-none border-0 border-l-2 bg-transparent px-4 py-3 text-left font-sans text-[16px]'
  if (active) return `${base} border-l-accent bg-panel font-bold text-ink`
  return `${base} border-l-transparent text-mute`
}

export function settingsFieldClass() {
  return 'w-full rounded-lg border-0 bg-panel px-4 py-3 font-sans text-[16px] text-ink outline-none focus:ring-1 focus:ring-accent'
}

export function playlistChipClass(selected) {
  if (selected) {
    return 'flex w-full cursor-pointer rounded-lg border-0 bg-accent px-4 py-3 text-left font-sans text-[clamp(14px,1vw,16px)] font-bold text-ink'
  }
  return 'flex w-full cursor-pointer rounded-lg border-0 bg-panel px-4 py-3 text-left font-sans text-[clamp(14px,1vw,16px)] text-ink'
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
