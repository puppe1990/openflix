import { faker } from '@faker-js/faker'

export { faker }

export function fakerPortalHost() {
  return faker.internet.domainName().toLowerCase()
}

export function fakerPortal({ protocol = 'http', port } = {}) {
  const host = fakerPortalHost()
  const chosen = port ?? faker.helpers.arrayElement([80, 8080, 25461, 8880])
  if ((protocol === 'http' && chosen === 80) || (protocol === 'https' && chosen === 443)) {
    return `${protocol}://${host}`
  }
  return `${protocol}://${host}:${chosen}`
}

export function fakerUsername() {
  const raw = faker.internet
    .username()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 12)
  return raw || 'user'
}

export function fakerPassword() {
  return faker.string.alphanumeric({ length: 12 })
}

export function fakerPlaylistName() {
  return faker.company.name()
}

export function fakerUnixSeconds({ days = 30 } = {}) {
  return Math.floor(faker.date.soon({ days }).getTime() / 1000)
}

export function fakerXtreamLogin(overrides = {}) {
  const username = overrides.username ?? fakerUsername()
  const password = overrides.password ?? fakerPassword()
  const portal = overrides.portal
  const serverUrl = portal ? new URL(portal) : null
  return {
    user_info: {
      username,
      password,
      auth: overrides.auth ?? 1,
      status: overrides.status ?? 'Active',
      exp_date: String(overrides.expDate ?? fakerUnixSeconds()),
      is_trial: '0',
      active_cons: String(overrides.activeCons ?? faker.number.int({ min: 0, max: 2 })),
      max_connections: String(overrides.maxConnections ?? faker.helpers.arrayElement([1, 2, 3])),
      created_at: String(fakerUnixSeconds({ days: 200 })),
    },
    server_info: {
      url: serverUrl ? serverUrl.hostname : fakerPortalHost(),
      port: serverUrl
        ? serverUrl.port || (serverUrl.protocol === 'https:' ? '443' : '80')
        : String(faker.helpers.arrayElement([80, 8080])),
      https_port: '443',
      server_protocol: serverUrl ? serverUrl.protocol.replace(':', '') : 'http',
      timezone: faker.location.timeZone(),
      timestamp_now: Math.floor(Date.now() / 1000),
    },
  }
}

export function fakerCategory(overrides = {}) {
  return {
    category_id: String(overrides.id ?? faker.number.int({ min: 1, max: 99 })),
    category_name: overrides.name ?? faker.commerce.department(),
    parent_id: 0,
  }
}

export function fakerLiveStream(overrides = {}) {
  return {
    num: faker.number.int({ min: 1, max: 500 }),
    name:
      overrides.name ??
      `${faker.company.name()} ${faker.helpers.arrayElement(['HD', 'FHD', 'SD'])}`,
    stream_type: 'live',
    stream_id: overrides.streamId ?? faker.number.int({ min: 1000, max: 99_999 }),
    stream_icon: faker.image.url(),
    epg_channel_id: faker.string.alphanumeric(8),
    added: String(fakerUnixSeconds()),
    category_id: String(overrides.categoryId ?? faker.number.int({ min: 1, max: 20 })),
    tv_archive: 0,
    direct_source: '',
    tv_archive_duration: 0,
  }
}

export function fakerVodStream(overrides = {}) {
  return {
    num: faker.number.int({ min: 1, max: 500 }),
    name: overrides.name ?? faker.lorem.words({ min: 2, max: 4 }),
    stream_type: 'movie',
    stream_id: overrides.streamId ?? faker.number.int({ min: 1000, max: 99_999 }),
    stream_icon: faker.image.url(),
    rating: faker.number.float({ min: 1, max: 10, fractionDigits: 1 }),
    added: String(fakerUnixSeconds()),
    category_id: String(overrides.categoryId ?? faker.number.int({ min: 1, max: 20 })),
    container_extension:
      overrides.containerExtension ?? faker.helpers.arrayElement(['mp4', 'mkv', 'avi']),
    direct_source: '',
  }
}

export function fakerSeriesEntry(overrides = {}) {
  return {
    num: faker.number.int({ min: 1, max: 500 }),
    name: overrides.name ?? faker.lorem.words({ min: 2, max: 4 }),
    series_id: overrides.seriesId ?? faker.number.int({ min: 100, max: 9999 }),
    cover: faker.image.url(),
    plot: faker.lorem.sentence(),
    cast: faker.person.fullName(),
    rating: String(faker.number.float({ min: 1, max: 10, fractionDigits: 1 })),
    category_id: String(overrides.categoryId ?? faker.number.int({ min: 1, max: 20 })),
  }
}

export function fakerEpisode(overrides = {}) {
  return {
    id: overrides.id ?? faker.number.int({ min: 10_000, max: 99_999 }),
    title: overrides.title ?? faker.lorem.words({ min: 2, max: 5 }),
    container_extension: overrides.containerExtension ?? 'mp4',
    season: overrides.season ?? faker.number.int({ min: 1, max: 5 }),
    episode_num: overrides.episodeNum ?? faker.number.int({ min: 1, max: 12 }),
  }
}

export function fakerM3uItem(overrides = {}) {
  return {
    title: overrides.title ?? faker.company.name(),
    group: overrides.group ?? faker.commerce.department(),
    tvgId: overrides.tvgId ?? faker.string.alphanumeric(6),
    tvgLogo: overrides.tvgLogo ?? faker.image.url(),
    url: overrides.url ?? `http://${fakerPortalHost()}/live/${faker.string.alphanumeric(8)}.m3u8`,
  }
}

export function fakerM3uPlaylist(items) {
  const rows = items ?? [fakerM3uItem(), fakerM3uItem()]
  const body = rows
    .map(
      (item) =>
        `#EXTINF:-1 tvg-id="${item.tvgId}" tvg-name="${item.title}" tvg-logo="${item.tvgLogo}" group-title="${item.group}",${item.title}\n${item.url}`,
    )
    .join('\n')
  return `#EXTM3U\n${body}\n`
}

export function fakerPrimeNavNode(overrides = {}) {
  const swiftPageType = overrides.swiftPageType ?? 'genre'
  const swiftPageId = overrides.swiftPageId ?? `av_genre_${faker.word.noun()}`
  const slug = swiftPageId.replace(/^av_genre_/, '')
  return {
    __type: 'atv.wps#NavigationSubNode',
    id: overrides.id ?? `V2=${faker.string.alphanumeric(48)}`,
    label: overrides.label ?? faker.commerce.department(),
    refMarker: overrides.refMarker ?? `hm_fin_c_${faker.string.alphanumeric(8)}`,
    swiftPageId,
    swiftPageType,
    url: overrides.url ?? `/genre/${slug}?jic=8%7CEgNhbGw%3D`,
  }
}

export function fakerPrimeNav(overrides = {}) {
  return {
    __type: 'atv.wps#EnrichNavOutput',
    categories: [],
    categoryGroups: overrides.categoryGroups ?? [
      {
        id: `V2=${faker.string.alphanumeric(24)}`,
        label: 'Gêneros',
        subNodes: [
          fakerPrimeNavNode({
            label: 'Ação e aventura',
            swiftPageType: 'genre',
            swiftPageId: 'av_genre_action',
            url: '/genre/action?jic=8%7CEgNhbGw%3D',
          }),
        ],
      },
      {
        id: `V2=${faker.string.alphanumeric(24)}`,
        label: 'Coleções em destaque',
        subNodes: [
          fakerPrimeNavNode({
            label: 'Feito para você',
            swiftPageType: 'merch',
            swiftPageId: 'mgForYou',
            url: '/collection/mgForYou?jic=8%7CEgNhbGw%3D',
          }),
          fakerPrimeNavNode({
            label: 'Loja',
            swiftPageType: 'home',
            swiftPageId: 'store',
            url: '/store?jic=8%7CEgNhbGw%3D',
          }),
        ],
      },
    ],
    channels: [],
    metadata: {},
  }
}

export function fakerPrimeEntity(overrides = {}) {
  const title = overrides.title ?? faker.music.songName()
  const titleID = overrides.titleID ?? `amzn1.dv.gti.${faker.string.uuid()}`
  const detailId = faker.string.alphanumeric(20).toUpperCase()
  return {
    displayTitle: title,
    title,
    titleID,
    entityType: overrides.entityType ?? 'Movie',
    releaseYear: overrides.releaseYear ?? String(faker.number.int({ min: 1990, max: 2026 })),
    runtime:
      overrides.runtime ??
      `${faker.number.int({ min: 1, max: 2 })} h ${faker.number.int({ min: 1, max: 59 })} min`,
    synopsis: overrides.synopsis ?? faker.lorem.sentence(),
    images: { cover: { url: overrides.coverUrl ?? faker.image.url() } },
    link: { url: overrides.href ?? `/-/pt/detail/${detailId}` },
    maturityRatingBadge: { displayText: overrides.badge ?? '14' },
    entitlementCues: {
      focusMessage: { message: overrides.entitlement ?? 'Incluído no Prime' },
      highValueMessage: { message: overrides.highValue ?? '' },
    },
  }
}

export function fakerPrimeLanding(overrides = {}) {
  return {
    __type: 'atv.wps#GetLandingPageOutput',
    hasFailed: overrides.hasFailed ?? false,
    containers: overrides.containers ?? [
      {
        containerType: 'StandardCarousel',
        title: overrides.rowTitle ?? faker.commerce.department(),
        isContinueWatching: false,
        entities: [fakerPrimeEntity(), fakerPrimeEntity()],
      },
    ],
    pageMetadata: { title: overrides.pageTitle ?? 'Prime Video' },
    pagination: overrides.pagination ?? {},
  }
}

/** videoId Innertube: 11 caracteres [A-Za-z0-9_-]. */
export function fakerYoutubeVideoId() {
  return faker.string.alphanumeric({ length: 11 })
}

function fakerYoutubeRuns(text) {
  return { runs: [{ text }] }
}

function fakerYoutubeThumb(url) {
  return {
    thumbnails: [
      { url: `${url}=s90`, width: 90, height: 68 },
      { url, width: 480, height: 360 },
    ],
  }
}

/** Card clássico videoRenderer da home/busca WEB. */
export function fakerYoutubeVideoRenderer(overrides = {}) {
  const title = overrides.title ?? faker.music.songName()
  const videoId = overrides.videoId ?? fakerYoutubeVideoId()
  const coverUrl = overrides.coverUrl ?? faker.image.url()
  return {
    videoId,
    title: fakerYoutubeRuns(title),
    lengthText: { simpleText: overrides.length ?? '12:34' },
    ownerText: fakerYoutubeRuns(overrides.channel ?? faker.person.fullName()),
    shortViewCountText: { simpleText: overrides.views ?? '1,2 mi de visualizações' },
    thumbnail: fakerYoutubeThumb(coverUrl),
  }
}

/** Card lockupViewModel da home WEB 2026. */
export function fakerYoutubeLockup(overrides = {}) {
  const title = overrides.title ?? faker.music.songName()
  const videoId = overrides.videoId ?? fakerYoutubeVideoId()
  const coverUrl = overrides.coverUrl ?? faker.image.url()
  return {
    contentId: videoId,
    contentType: 'LOCKUP_CONTENT_TYPE_VIDEO',
    metadata: {
      lockupMetadataViewModel: {
        title: { content: title },
      },
    },
    contentImage: {
      thumbnailViewModel: {
        image: { sources: [{ url: coverUrl }] },
      },
    },
  }
}

/** Browse FEwhat_to_watch: grade + prateleira. */
export function fakerYoutubeBrowse(overrides = {}) {
  const grid = overrides.grid ?? [fakerYoutubeVideoRenderer()]
  const shelfTitle = overrides.shelfTitle ?? faker.commerce.department()
  const shelf = overrides.shelf ?? [fakerYoutubeLockup()]
  return {
    contents: {
      twoColumnBrowseResultsRenderer: {
        tabs: [
          {
            tabRenderer: {
              content: {
                richGridRenderer: {
                  contents: [
                    ...grid.map((renderer) => ({
                      richItemRenderer: { content: { videoRenderer: renderer } },
                    })),
                    {
                      richSectionRenderer: {
                        content: {
                          richShelfRenderer: {
                            title: fakerYoutubeRuns(shelfTitle),
                            contents: shelf.map((lockup) => ({
                              richItemRenderer: { content: { lockupViewModel: lockup } },
                            })),
                          },
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    },
  }
}

/** Busca WEB: itemSection com videoRenderer. */
export function fakerYoutubeSearch(overrides = {}) {
  const videos = overrides.videos ?? [fakerYoutubeVideoRenderer(), fakerYoutubeVideoRenderer()]
  return {
    contents: {
      twoColumnSearchResultsRenderer: {
        primaryContents: {
          sectionListRenderer: {
            contents: [
              {
                itemSectionRenderer: {
                  contents: videos.map((renderer) => ({ videoRenderer: renderer })),
                },
              },
            ],
          },
        },
      },
    },
  }
}

/** /player ANDROID com itag 18 muxed (ftypmp42). */
export function fakerYoutubePlayer(overrides = {}) {
  const videoId = overrides.videoId ?? fakerYoutubeVideoId()
  const title = overrides.title ?? faker.music.songName()
  const googlevideo =
    overrides.googlevideo ??
    `https://rr${faker.number.int({ min: 1, max: 5 })}---sn-host.googlevideo.com/videoplayback?id=${videoId}&itag=18`
  const status = overrides.status ?? 'OK'
  return {
    playabilityStatus: {
      status,
      reason: overrides.reason ?? '',
    },
    videoDetails: { videoId, title, author: overrides.channel ?? faker.person.fullName() },
    streamingData: {
      hlsManifestUrl: overrides.hlsManifestUrl ?? '',
      formats: [
        {
          itag: 18,
          mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"',
          qualityLabel: '360p',
          url: overrides.url === undefined ? googlevideo : overrides.url,
        },
        {
          itag: 22,
          mimeType: 'video/mp4; codecs="avc1.64001F, mp4a.40.2"',
          qualityLabel: '720p',
          url: '',
          signatureCipher: 's=AA&url=https://example.net/cipher',
        },
      ],
      adaptiveFormats: [],
    },
  }
}
