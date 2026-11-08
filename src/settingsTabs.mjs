export const SETTINGS_TABS = [
  { id: 'playlists', label: 'Playlists' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'prime', label: 'Prime Video' },
  { id: 'youtube', label: 'YouTube' },
]

export const DEFAULT_SETTINGS_TAB = 'playlists'

const TAB_IDS = SETTINGS_TABS.map((tab) => tab.id)
const SETTINGS_TAB_IDS = `${TAB_IDS.slice(0, -1).join(', ')} ou ${TAB_IDS.at(-1)}`

/** Confere o id da aba interna de Ajustes. */
export function selectSettingsTab(id) {
  if (!SETTINGS_TABS.some((tab) => tab.id === id)) {
    throw new Error(`aba de ajustes recusada: recebido ${id}, esperado ${SETTINGS_TAB_IDS}`)
  }
  return id
}

/** Painel some quando a aba ativa é outra. */
export function settingsPaneHidden(activeId, paneId) {
  return selectSettingsTab(activeId) !== paneId
}

/** Chips e nome ficam fora das abas Prime Video e YouTube. */
export function settingsListsHidden(tabId) {
  const id = selectSettingsTab(tabId)
  return id === 'prime' || id === 'youtube'
}
