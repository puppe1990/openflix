export const YOUTUBE_ORIGIN = 'https://www.youtube.com'

export const YOUTUBE_BROWSE = '/youtubei/v1/browse'
export const YOUTUBE_SEARCH = '/youtubei/v1/search'
export const YOUTUBE_PLAYER = '/youtubei/v1/player'
export const YOUTUBE_NEXT = '/youtubei/v1/next'
export const YOUTUBE_GUIDE = '/youtubei/v1/guide'
export const YOUTUBE_ACCOUNT_MENU = '/youtubei/v1/account/account_menu'

export const WEB_CLIENT_NAME = 'WEB'
export const WEB_CLIENT_VERSION = '2.20261105.05.01'
export const ANDROID_CLIENT_NAME = 'ANDROID'
export const ANDROID_CLIENT_VERSION = '20.10.4'
export const ANDROID_SDK = 30
export const ANDROID_OS_VERSION = '11'
export const ANDROID_USER_AGENT = 'com.google.android.youtube/20.10.4 (Linux; U; Android 11) gzip'
export const IOS_CLIENT_NAME = 'IOS'
export const IOS_CLIENT_VERSION = '20.10.4'
export const IOS_DEVICE_MODEL = 'iPhone16,2'
export const IOS_OS_VERSION = '18.3.2.22D82'

const ALLOWED = [
  YOUTUBE_BROWSE,
  YOUTUBE_SEARCH,
  YOUTUBE_PLAYER,
  YOUTUBE_NEXT,
  YOUTUBE_GUIDE,
  YOUTUBE_ACCOUNT_MENU,
]

const ALLOWED_LABEL = ALLOWED.join(', ').replace(/, ([^,]+)$/, ' ou $1')

/** Recusa qualquer chamada fora do Innertube WEB de catálogo/player. */
export function assertYoutubeRequest(method, path) {
  if (method === 'POST' && ALLOWED.includes(path)) return
  throw new Error(
    `endpoint do youtube recusado: recebido ${method} ${path}, esperado POST ${ALLOWED_LABEL}`,
  )
}

/** WEB no browse/search/guide/next; /player começa no ANDROID (itag 18). */
export function youtubeClientKindFor(path) {
  return path === YOUTUBE_PLAYER ? 'android' : 'web'
}

function clientContext(kind) {
  if (kind === 'android') {
    return {
      clientName: ANDROID_CLIENT_NAME,
      clientVersion: ANDROID_CLIENT_VERSION,
      androidSdkVersion: ANDROID_SDK,
      osName: 'Android',
      osVersion: ANDROID_OS_VERSION,
      hl: 'pt',
      gl: 'BR',
    }
  }
  if (kind === 'ios') {
    return {
      clientName: IOS_CLIENT_NAME,
      clientVersion: IOS_CLIENT_VERSION,
      deviceModel: IOS_DEVICE_MODEL,
      osName: 'iPhone',
      osVersion: IOS_OS_VERSION,
      hl: 'pt',
      gl: 'BR',
    }
  }
  return {
    clientName: WEB_CLIENT_NAME,
    clientVersion: WEB_CLIENT_VERSION,
    hl: 'pt',
    gl: 'BR',
  }
}

/** Corpo WEB (browse/search/guide) com locale pt-BR. */
export function youtubeWebBody(extra = {}) {
  return { context: { client: clientContext('web') }, ...extra }
}

/** Corpo ANDROID (/player) com itag 18 muxed. */
export function youtubeAndroidBody(extra = {}) {
  return {
    context: { client: clientContext('android') },
    contentCheckOk: true,
    racyCheckOk: true,
    ...extra,
  }
}

/** Corpo IOS (/player) quando o ANDROID responde LOGIN_REQUIRED de bot. */
export function youtubeIosBody(extra = {}) {
  return {
    context: { client: clientContext('ios') },
    contentCheckOk: true,
    racyCheckOk: true,
    ...extra,
  }
}

/** ANDROID primeiro (itag 18); IOS se bot-check; WEB assinado se os dois pedirem LOGIN_REQUIRED. */
export function youtubePlayerBodies(extra = {}) {
  return [
    youtubeAndroidBody(extra),
    youtubeIosBody(extra),
    youtubeWebBody({ contentCheckOk: true, racyCheckOk: true, ...extra }),
  ]
}
