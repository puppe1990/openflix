# Prime Video (web) — mapa dos endpoints observados

Mapa do que o site oficial `www.primevideo.com` chama para navegar, configurar o player e
iniciar a reprodução. Levantado em **07/11/2026** a partir de uma captura do Chrome 155
(macOS) logado numa conta Prime brasileira, com o Network Listener
(`network-listener-2026-11-04-20-50-48_2026-11-07-16-08-34.csv`). Não é documentação da
Amazon: é o que o cliente web deles fez naquela sessão.

Contexto de mercado da captura:

| Campo             | Valor                                   |
| ----------------- | --------------------------------------- |
| `marketplaceID`   | `ART4WZ8MWBX2Y` (Brasil)                |
| `uxLocale`        | `pt_BR`                                 |
| `deviceTypeID`    | `AOAGZA014O5RE` (player web)            |
| `deviceID`        | UUID persistido no browser              |
| `customerID`      | omitido (id da conta da sessão)         |
| Player SDK        | `ATVWebPlayerSDK-1.0.246461.0`          |
| Resolução de tela | 1440×900 / 1920×1080 (varia por janela) |

> Nenhum `Cookie` aparece nos headers gravados pela captura. A autenticação viaja nos
> cookies de sessão de `www.primevideo.com` (as chamadas de API são `same-site`); o mapa
> abaixo registra os parâmetros explícitos, não o conteúdo do cookie.

## 1. Hosts

| Host                                                    | Papel                                      | Exemplos                                               |
| ------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `www.primevideo.com`                                    | Loja (HTML) + BFF JSON do site             | `/api/getLandingPage`, `/detail/{id}`                  |
| `atv-ps.primevideo.com`                                 | API de playback/config do player ("PS")    | `/playback/prs/*`, `/cdp/*`, `/acm/*`                  |
| `atv-ext.amazon.com`                                    | Callback de refresh das `playbackSettings` | `/cdp/playback/RefreshPlaybackSettings`                |
| `*.vod-dash.main.amazon.pv-cdn.net`                     | MPD/segmentos VOD (CloudFront)             | `/dm/...mpd`                                           |
| `*.akamaized.net`                                       | MPD/segmentos (Akamai), VOD e linear       | `a164avoddashs3ww-a.akamaihd.net`                      |
| `*.fastly-edge.com`                                     | Failover de linear ao vivo                 | `live-pv-ta-enf.amazon.fastly-edge.com`                |
| `images-na.ssl-images-amazon.com`, `m.media-amazon.com` | Arte (capas, logos, stills)                | `pv-target-images/...`                                 |
| `fls-na.amazon.com`, `unagi*.amazon.com(.br)`           | Telemetria Amazon (CSM, `uedata`)          | `/rd/uedata`, `/events/com.amazon...`                  |
| `global.telemetry.insights.video.a2z.com`               | Telemetria de vídeo                        | `/Bootstrap/AV20260921`, `/Events/AV20180101`          |
| `*.minerva.devices.a2z.com`                             | Métricas de device                         | `/v2/metric-batch`                                     |
| `prod.us-east-1.sonar.prime-video.amazon.dev`           | Sonar (diagnóstico do player)              | `POST /`                                               |
| `www.amazon.com.br`                                     | Conta/perfil e menu Prime do varejo        | `/hz/profilepicker`, `/hz/primenavigation/primeflyout` |

## 2. Parâmetros comuns

Quase toda chamada em `atv-ps.primevideo.com` repete o mesmo bloco na query string:

```
deviceID=84a5e297-c436-45f5-8848-e3cad57374f3
deviceTypeID=AOAGZA014O5RE
marketplaceID=ART4WZ8MWBX2Y
uxLocale=pt_BR
gascEnabled=true
firmware=1
version=1                 # só nos /cdp/usage/*
nerid=<nonce por request> # correlaciona com a telemetria
```

`nerid` muda a cada request (base64 com `00` no fim). `deviceID` é gerado no browser e
persistido; `deviceTypeID` identifica a família de device (web) e decide o catálogo de
recursos que o servidor devolve.

Headers relevantes:

| Endpoint                            | `content-type`     | `accept`           | `x-request-priority`                              |
| ----------------------------------- | ------------------ | ------------------ | ------------------------------------------------- |
| `/playback/prs/*`                   | `text/plain`       | `*/*`              | —                                                 |
| `/cdp/playback/pes/*`               | `application/json` | `application/json` | `CRITICAL` (start) / `NOTIFICATION` (update/stop) |
| `/cdp/catalog/GetPlaybackResources` | — (GET)            | `*/*`              | —                                                 |

## 3. Navegação (loja)

### 3.1 `POST /api/getLandingPage`

Form-urlencoded. Monta as fileiras da home; é paginado.

| Campo                 | Exemplo                  | Observação                            |
| --------------------- | ------------------------ | ------------------------------------- |
| `pageType` / `pageId` | `home` / `home`          | também `movies`, `tv`, `store`…       |
| `pageNumber`          | `2`                      | página lógica                         |
| `pageSize`            | `14`                     | itens por carrossel                   |
| `startIndex`          | `7`                      | offset                                |
| `serviceToken`        | `v0_Cl0K...`             | ~3,4 KB, opaco, emitido pelo servidor |
| `targetId`            | `V2=4AEA...`             | id opaco do widget/página             |
| `variant`             | `desktopOSX`             | layout                                |
| `actionScheme`        | `default`                |                                       |
| `payloadScheme`       | `default`                |                                       |
| `decorationScheme`    | `web-decoration-gti-v4`  | versão do decorador de card           |
| `featureScheme`       | `web-features-v6`        |                                       |
| `dynamicFeatures`     | `RecordingCardSupported` |                                       |
| `widgetScheme`        | `web-explore-v48`        | versão do widget de exploração        |

Resposta `atv.wps#GetLandingPageOutput`:

```jsonc
{
  "__type": "atv.wps#GetLandingPageOutput",
  "containers": [
    {
      "containerType": "StandardCarousel", // + title
      "entities": [/* card: titleId, images.cover.url, … */],
    },
  ],
}
```

O corpo é grande e paginado (o visualizador da captura corta em ~128 KB); o cliente busca em
fatias (`pageSize` + `startIndex`) em vez de pedir a home inteira.

### 3.2 `POST /api/enrichItemMetadata`

Form-urlencoded; enriquece até ~10 títulos de uma vez (hover, pré-roll, trailer, watchlist).

| Campo                   | Conteúdo                                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `metadataToEnrich`      | JSON: `{placement:"HOVER", playback:true, preroll:true, trailer:true, watchlist:true, impressionData:"<base64>"}`      |
| `titleIDsToEnrich`      | JSON array de `amzn1.dv.gti.<uuid>`                                                                                    |
| `journeyIngressContext` | `88` + `<base64>` (origem da navegação: `globopaytvbr`, `getvbcr`, `lunastandar`, `cazetvbcr`, `subscription`, `svod`) |
| `currentUrl`            | `https://www.primevideo.com/-/pt_BR/`                                                                                  |

Resposta `atv.wps#StorefrontEnrichItemsOutput` com `enrichments[titleId]` (playback,
preroll, trailer, watchlist, impressão).

### 3.3 `GET /api/enrichNav?enrichmentType=GET_CATEGORIES`

Resposta `atv.wps#EnrichNavOutput`:

```jsonc
{
  "__type": "atv.wps#EnrichNavOutput",
  "categories": [],
  "categoryGroups": [{ "id": "V2=4AEA...", "label": "Gêneros", "subNodes": [/* 12 itens */] }],
  "channels": [],
  "metadata": {
    "availability": {
      "severity": "MinorDegradation",
      "description": "Fatal Count: 0, Error Count: 0, Warning Count: 2",
    },
  },
}
```

Os ids (`V2=...`) são os mesmos `targetId` usados no `getLandingPage` — é assim que o site
pede "filmes", "séries", "gêneros X" sem inventar rota.

### 3.4 Páginas e variantes regionais

| Rota                                | Método | Uso                           |
| ----------------------------------- | ------ | ----------------------------- |
| `/detail/{id}`                      | GET    | Página HTML do título         |
| `/region/na/detail/{id}`            | GET    | Mesma página no cluster `na`  |
| `/region/na/api/getLivePage`        | GET    | Grade/ao vivo do cluster `na` |
| `/region/na/api/enrichNav`          | GET    | Espelho regional do nav       |
| `/region/na/api/enrichItemMetadata` | POST   | Espelho regional do enrich    |

Ids de exibição linear têm a forma
`amzn1.p11cat.amzn1.pv.linear.airing.sa-<uuid>::<epochMs>::pb-<uuid>`; quando o horário
passa, a rota devolve **404** — o id é efêmero.

## 4. Configuração e resiliência

| Endpoint                                     | Método | Devolve                                                                                                                                                        |
| -------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/acm/GetConfiguration/WebClient`            | GET    | `requestContext{marketplaceID, customerID, currentTerritory, recordTerritory}`, `contingencies.resiliencyDisabled`, `timeToRefreshInSeconds:600`, `testGroups` |
| `/acm/GetConfiguration/atvweb-player-config` | GET    | Config do player web (CORS: `OPTIONS` antes)                                                                                                                   |
| `/acm/GetConfiguration/xpPlayerconfigs`      | GET    | Configs do player XP                                                                                                                                           |
| `/acm/GetConfiguration/AppResiliency`        | GET    | Circuitos de resiliência do app                                                                                                                                |
| `/cdp/usage/GetAppStartupConfig`             | GET    | `territoryConfig`, `deviceConfig`, `customerConfig`                                                                                                            |
| `/cdp/lumina/playerChromeResources/v1`       | GET    | Recursos do chrome do player (Lumina)                                                                                                                          |
| `/cdp/usage/GetWeblabTreatment`              | POST   | Tratamento de weblab/experimento                                                                                                                               |
| `/cdp/usage/UpdateStream`                    | GET    | Atualização de estado de stream                                                                                                                                |

`GetAppStartupConfig` é o "mapa do território" da sessão:

```jsonc
{
  "territoryConfig": {
    "avMarketplace": "ART4WZ8MWBX2Y",
    "defaultPrimeMarketplace": "A2Q3Y263D00KWC",
    "defaultRetailMarketplace": "A2Q3Y263D00KWC",
    "expiresAt": "…",
  },
  "deviceConfig": {
    "playbackAllowed": false,
    "bandwidthCheckUrl": "https://amazon.hs.llnwd.net/d19/h264/cdpBandwidthTest.mp4?h=…",
    "bandwidthCheckFileSize": 191428410,
    "logLevel": "ERROR",
  },
  "customerConfig": {
    "baseUrl": "na-f.api.amazonvideo.com",
    "homeRegion": "NA",
    "currentTerritory": "BR",
    "videoCountryOfRecord": "BR",
    "preferredLanguage": "en_US",
    "expiresIn": 60,
  },
}
```

> `deviceConfig.playbackAllowed` veio **false** nesta captura mesmo com o player abrindo. Vale
> investigar: pode ser um gate de DRM/capacidade — e explicaria parte do travamento no
> WKWebView.

## 5. Playback VOD

Quatro peças: **PRS** (recursos) · **PES** (sessão) · **DRM** (licença) ·
**PES Update/Stop** (progresso). O MPD vem pronto do PRS, com token embutido.

### 5.1 `POST /playback/prs/GetVodPlaybackResources?titleId=<gti>`

Corpo JSON (o `playbackEnvelope` é o ponto crítico — ver §7):

```jsonc
{
  "globalParameters": {
    "deviceCapabilityFamily": "WebPlayer",
    "playbackEnvelope": "eyJ0eXAiOiJwbGVuditqd2Ui…", // JWE opaco, ~1,3 KB
    "capabilityDiscriminators": {
      "operatingSystem": { "name": "Mac OS X", "version": "10.15.7" },
      "middleware": { "name": "Chrome", "version": "155.0.0.0" },
      "nativeApplication": { "name": "Chrome", "version": "155.0.0.0" },
      "hfrControlMode": "Legacy",
      "displayResolution": { "width": 3840, "height": 2160 },
    },
  },
  "auditPingsRequest": {},
  "widevineServiceCertificateRequest": {},
  "playbackDataRequest": {},
  "timedTextUrlsRequest": { "supportedTimedTextFormats": ["TTMLv2", "…"] },
  "trickplayUrlsRequest": {},
  "transitionTimecodesRequest": {},
  "vodPlaylistedPlaybackUrlsRequest": {
    "device": {
      "hdcpLevel": "1.4",
      "maxVideoResolution": "1080p",
      "supportedStreamingTechnologies": ["DASH"],
      "displayWidth": 3840,
      "displayHeight": 2160,
    },
    "ads": {
      "sitePageUrl": "https://www.primevideo.com/-/pt_BR/",
      "mainContentResumeOffsetHintMillis": 0,
      "playerContractVersion": 1,
    },
    "playbackCustomizations": {},
    "playbackSettingsRequest": {
      "operatingSystemName": "Mac OS X",
      "firmware": "UNKNOWN",
      "playerType": "xp",
      "responseFormatVersion": "1.0.0",
      "titleId": "<gti>",
    },
  },
  "vodXrayMetadataRequest": {
    "xrayDeviceClass": "normal",
    "xrayPlaybackMode": "playback",
    "xrayToken": "XRAY_WEB_2023_V2",
  },
}
```

Resposta:

```jsonc
{
  "sessionization": {
    "sessionHandoffToken": "eyJ0eXAiOiJzaG9mZitqd2Ui…", // JWE, ~650 B
    "drmCaching": "MAY_CACHE",
    "sessionTrackingMode": "PLAY_START_SESSION_TRACKING_ONLY",
  },
  "auditPings": { "result": {} },
  "widevineServiceCertificate": { "result": { "encodedServiceCertificate": "CAUSwgU…" } },
  "playbackData": { "result": { "contentId": "amzn1.dv.vcid.<uuid>" } },
  "timedTextUrls": { "error": { "code": "Invalid", "message": "Invalid request" } },
  "trickplayUrls": { "error": { "code": "Invalid", "message": "Invalid request" } },
  "transitionTimecodes": { "error": { "code": "Invalid", "message": "Invalid request" } },
  "vodXrayMetadata": { "error": { "code": "Invalid", "message": "Invalid request" } },
  "vodPlaylistedPlaybackUrls": {
    "result": {
      "playbackUrls": {
        "fullTitleDurationMs": 15000,
        "failoverPolicy": { "cdnOrder": ["cloudfront", "akamai"] },
        "timedTextRepresentation": "NotInManifestNorStream",
        "intraTitlePlaylist": [
          {
            "type": "Main",
            "startMs": 0,
            "endMs": 15000,
            "urls": [
              {
                "url": "https://ABS…vod-dash.main.amazon.pv-cdn.net/dm/3$0CiEI…/ww_gru/…/…_corrected.mpd",
                "cdn": "cloudfront",
                "origin": "popular_ssai_s3_ww_gru_br",
                "consumptionId": "…",
              },
              {
                "url": "https://a164avoddashs3ww-a.akamaihd.net/3$0CiEI…/ww_gru/…/…_corrected.mpd",
                "cdn": "akamai",
                "origin": "ssai_s3_ww_gru",
                "consumptionId": "…",
              },
            ],
            "nonLinearAds": [],
            "audioTracks": [
              {
                "audioTrackId": "pt-br_dialog_0",
                "languageCode": "pt-br",
                "displayName": "Português (Brasil)",
                "audioSubtype": "dialog",
                "trackGroupId": "<uuid>",
              },
            ],
            "manifestMetadata": {
              "bitrateAdaptation": "CVBR",
              "codec": "H264",
              "dynamicRange": "None",
              "resolution": "HD_1080P",
              "streamingProtocol": "DASH",
              "videoQuality": "HD",
            },
            "caching": {
              "timeToLive": "PT120H",
              "mediaAssetCacheKey": "amzn1.dv.a.a.<hash>",
              "mediaAssetTimeToLive": "PT720H",
            },
          },
        ],
      },
      "playbackSettings": {
        "result": {
          "formatVersion": "1.0.0",
          "settingsId": "xp-MPC-vod-…",
          "callback": {
            "url": "https://atv-ext.amazon.com/cdp/playback/RefreshPlaybackSettings?refreshToken=…",
            "delayIso8601": "PT2H",
          },
          "caching": { "timeToLiveIso8601": "PT2H" },
          "playbackSettings": "<base64 de um JSON com o MPC: cluster, bitrate caps, buffer, scheduler>",
        },
      },
    },
  },
  "__metadata": { "region": "us-east-1", "id": "…" },
}
```

Notas:

- `playlistItem.endMs - startMs` é o trecho autorizado. Na captura todos os PRS de VOD
  devolveram **~15 s** (trailer de hover), não o filme inteiro.
- `intraTitlePlaylist` permite vários trechos (filme + conteúdo extra). O player escolhe
  pelo `type`/`startMs`.
- `failoverPolicy.cdnOrder` define a ordem de tentativa; cada item já traz `consumptionId`
  por CDN.
- `playbackSettings.playbackSettings` é a configuração do MPC (media playback controller):
  o player não decide buffer/bitrate, ele segue esse blob.

### 5.2 PES — ciclo de sessão

`POST /cdp/playback/pes/StartSession` (query com o bloco comum + `version=1`):

```jsonc
{
  "sessionHandoff": "<sessionHandoffToken do PRS>",
  "playbackEnvelope": "<o mesmo envelope do PRS>",
  "streamInfo": {
    "eventType": "START",
    "streamUpdateTime": "2026-11-07T16:25:48.691Z",
    "streamIntent": "AUTOPLAY",
    "vodProgressInfo": { "currentProgressTime": "PT0.001345S", "timeFormat": "ISO8601DURATION" },
  },
  "userWatchSessionId": "<uuid por reprodução>",
}
```

Resposta: `{ "callbackIntervalInSeconds": 180 }`.

`POST /cdp/playback/pes/UpdateSession` — a cada ~180 s e em pausa/seek:

```jsonc
{
  "sessionToken": "eyJ0eXAiOiJzdG9rbitqd3Mi…", // JWE HS512, ~4 KB
  "streamInfo": {
    "eventType": "PLAY", // START | PLAY | PAUSE | STOP | …
    "streamUpdateTime": "2026-11-07T16:06:24.637Z",
    "liveProgressInfo": {
      "currentProgressTime": "2026-11-07T16:06:17.681Z",
      "timeFormat": "ISO8601DATETIME",
    },
  },
}
```

Resposta: `{ "callbackIntervalInSeconds": 180, "sessionToken": "…" }` — o token é rotacionado.

`POST /cdp/playback/pes/StopSession` — mesmo corpo com `eventType: "STOP"`; resposta `{}`.
O `sessionToken` sai do Start/Update; não é o `sessionHandoffToken`.

### 5.3 Licença Widevine

Duas portas equivalentes:

**a) Dedicada** — `POST /playback/drm-linear/GetWidevineLicense?titleId=<gti>`

```jsonc
{
  "includeHdcpTestKey": true,
  "playbackEnvelope": "…",
  "sessionHandoffToken": "…",
  "licenseChallenge": "CAES2CYSWwpZ…", // ~6,8 mil chars base64: desafio do CDM
}
```

Resposta:

```jsonc
{
  "widevineLicense": {
    "license": "CAISvQIKLAoQ…", // ~960 B
    "metadata": {
      "keyMetadata": [/* 2 chaves */],
      "licensePolicies": { "licenseDuration": "PT71H57M45S", "playbackDuration": "PT71H57M45S" },
    },
  },
}
```

**b) Pelo catálogo** — `POST /cdp/catalog/GetPlaybackResources?desiredResources=Widevine2License`
devolve `widevine2License.license` + `metadata.keyIds` + `keyMetadata` + `licensePolicies`,
junto do `returnedTitleRendition`.

### 5.4 `POST /cdp/catalog/GetPlaybackResources` (a via "tudo em um")

GET/POST com **tudo na query** (7 chamadas na captura, incluindo ao vivo). Parâmetros
importantes:

| Parâmetro                                                       | Exemplo                                                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `asin`                                                          | `amzn1.dv.gti.38f13597-…`                                                                                                                                                                        |
| `consumptionType`                                               | `Streaming`                                                                                                                                                                                      |
| `videoMaterialType`                                             | `LiveStreaming`, `Movie`, `Episode`                                                                                                                                                              |
| `desiredResources`                                              | CSV: `PlaybackUrls,CuepointPlaylist,SubtitleUrls,ForcedNarratives,TrickplayUrls,TransitionTimecodes,PlaybackSettings,CatalogMetadata,LiveSchedule,LinearRestrictions,SyeUrlsV2,Widevine2License` |
| `resourceUsage`                                                 | `ImmediateConsumption`                                                                                                                                                                           |
| `playerType`                                                    | `xp`                                                                                                                                                                                             |
| `operatingSystemName` / `Version`                               | `Mac OS X` / `10.15.7`                                                                                                                                                                           |
| `deviceApplicationName`                                         | `Chrome`                                                                                                                                                                                         |
| `clientId`                                                      | UUID do client                                                                                                                                                                                   |
| `userWatchSessionId`                                            | UUID da reprodução                                                                                                                                                                               |
| `sitePageUrl`                                                   | `https://www.primevideo.com/region/na/detail/<id>?ref_=atv_plr_live_play`                                                                                                                        |
| `displayWidth` / `displayHeight`                                | `1680` / `1050`                                                                                                                                                                                  |
| `deviceDrmOverride`                                             | `CENC`                                                                                                                                                                                           |
| `deviceStreamingTechnologyOverride`                             | `DASH`                                                                                                                                                                                           |
| `deviceVideoCodecOverride`                                      | `H264`                                                                                                                                                                                           |
| `deviceVideoQualityOverride`                                    | `SD`                                                                                                                                                                                             |
| `deviceAdInsertionTypeOverride`                                 | `SSAI`                                                                                                                                                                                           |
| `deviceHdrFormatsOverride`                                      | `None`                                                                                                                                                                                           |
| `deviceBitrateAdaptationsOverride`                              | `CVBR,CBR`                                                                                                                                                                                       |
| `audioTrackId`                                                  | `all`                                                                                                                                                                                            |
| `languageFeature`                                               | `MLFv2`                                                                                                                                                                                          |
| `liveManifestType`                                              | `patternTemplate,accumulating,live`                                                                                                                                                              |
| `supportedDRMKeyScheme`                                         | `DUAL_KEY`                                                                                                                                                                                       |
| `supportsEmbeddedTrickplay` / `supportsEmbeddedTimedTextForVod` | `true`                                                                                                                                                                                           |
| `ssaiSegmentInfoSupport` / `ssaiStitchType`                     | `Base` / `MultiPeriod`                                                                                                                                                                           |
| `gdprEnabled`                                                   | `false`                                                                                                                                                                                          |
| `playerAttributes`                                              | JSON: `{middlewareName, middlewareVersion, nativeApplicationName, nativeApplicationVersion, supportedAudioCodecs:"AAC", frameRate:"SFR", "H264.codecLevel":"3.1", …}`                            |

Resposta (resumida):

```jsonc
{
  "playbackUrls": {
    "cacheKey": "<uuid>",
    "defaultUrlSetId": "20764-…-09091",
    "urlSets": {
      "20764-…-09091": {
        "urlSetId": "…",
        "urls": {
          "manifest": {
            "url": "https://…/$T$2D3Rh…/cenc-sd.mpd",
            "drm": "CENC",
            "streamingTechnology": "DASH",
            "compressionStandard": "H264",
            "videoQuality": "HD",
            "cdn": "Cloudfront",
            "origin": "OTTE_P1_IAD_1",
            "livePlaybackStreamId": "P1_IAD_1",
            "duration": 5160000,
            "startTime": "2026-11-07T11:15:00.435Z",
            "segmentListRepresentation": "PatternRepetition",
            "fragmentRepresentation": "SeparateFile",
            "subtitleRepresentation": "SeparateStreamInManifest",
            "lookbackWindow": "Dynamic",
            "edgeDeliveryAuthorization": { "authorizationScheme": "Transparent" }
          }
        },
        "failover": { /* mesmo formato, outro CDN */ }
      }
    }
  },
  "cuepointPlaylist": { "additionalMetadata": { "showCountdownTimer": false } },
  "returnedTitleRendition": {
    "asin": "…",
    "contentId": "amzn1.dv.vcid.…",
    "videoMaterialType": "LiveStreaming",
    "videoQuality": "SD",
    "videoResolution": "576p",
    "audioQuality": "Stereo",
    "selectedEntitlement": { "benefit": "globopaytvbr", "entitlementType": "THIRD_PARTY_SUBSCRIPTION", "tierId": "amzn1.dv.channelTier.…" }
  },
  "liveSchedule": { "channelID": "…", "channelName": "sportv3", "scheduled": [ /* 9 programas */ ] },
  "linearRestrictions": { "defaultRestriction": { "rating": {…} }, "metadata": { "customerPin": {…} }, "programs": [ /* 4 */ ] },
  "errorsByResource": { "CatalogMetadata": { "errorCode": "PRS.InvalidRequest", "type": "PRSInvalidRequestException" } }
}
```

`errorsByResource` é normal: o cliente pede um pacote grande e o servidor devolve erro por
recurso que não se aplica (ex.: `TrickplayUrls` em linear).

## 6. Playback ao vivo e linear

### 6.1 `POST /playback/prs/GetLivePlaybackResources?titleId=<gti>`

Corpo com `livePlaybackUrlsRequest`, `syeUrlsRequest` (anúncio server-side), `xrayMetadataRequest`
e `globalParameters.sessionTrackingMode: "WITH_SESSION_HANDOFF"`.

```jsonc
"livePlaybackUrlsRequest": {
  "ads": { "sitePageUrl": "https://www.primevideo.com/region/na/detail/<id>?ref_=atv_plr_live_play", "gdpr": { "enabled": false, "consentMap": {} } },
  "device": {
    "firmwareVersion": "UNKNOWN",
    "hdcpLevel": "1.4",
    "liveManifestTypes": ["PatternTemplate", "Accumulating", "Live"],
    "playableLiveManifestTypes": { "PatternTemplate": {}, "Accumulating": {}, "Live": {} },
    "maxVideoResolution": "2160p",
    "operatingSystem": "Mac OS X",
    "supportedStreamingTechnologies": ["DASH"],
    "streamingTechnologies": { "DASH": {} },
    "thumbnailRepresentations": ["None", "…"]
  },
  "playbackSettingsRequest": { "operatingSystemName": "Mac OS X", "playerType": "xp", "responseFormatVersion": "1.0.0", "titleId": "<gti>" },
  "playbackCustomizations": { "fallbackExperience": { "enabled": true } }
}
```

Resposta:

```jsonc
{
  "sessionization": {
    "sessionHandoffToken": "…",
    "drmCaching": "MAY_CACHE",
    "sessionTrackingMode": "FULL_SESSION_TRACKING",
  },
  "widevineServiceCertificate": { "result": { "encodedServiceCertificate": "…" } },
  "playbackData": {
    "result": {
      "contentId": "amzn1.dv.vcid.…",
      "maxLiveLookback": "PT3H",
      "liveLookbackMetadata": {
        "liveLookbackControl": "Restricted",
        "liveLookbackRootMode": "Rolling",
        "liveLookbackRoot": "LiveHead",
        "liveLookbackOffset": "PT-3H",
      },
    },
  },
  "livePlaybackUrls": {
    "result": {
      "cacheKey": "…",
      "defaultUrlSetId": "20764-…-09091",
      "caching": { "timeToLive": "PT24H", "manifestTimeToLive": "PT360H" },
      "urlSets": {/* 6 variantes */},
      "fallbackExperienceUrlSets": {/* 6 */},
      "playbackSettings": {/* igual ao VOD */},
    },
  },
  "syeUrls": {
    "result": {
      "cdns": [/* … */],
      "duration": "PT1H26M",
      "startTime": "2026-11-07T11:15:00.435Z",
      "maxBitrateBps": 8000000,
      "compressionStandard": "H264",
      "dynamicRange": "None",
      "videoQuality": "HD",
    },
  },
}
```

### 6.2 `POST /playback/prs/GetLiveLinearPlaybackResources`

Mesma família, para **canal linear** (Canais Globo/SporTV). Corpo:
`globalParameters`, `auditPingsRequest`, `widevineServiceCertificateRequest`,
`playbackDataRequest`, `liveLinearPlaybackUrlsRequest`. A resposta traz
`sessionization`, `widevineServiceCertificate`, `playbackData`, `liveLinearPlaybackUrls`,
`auditPings`, telemetria e `__metadata`.

### 6.3 Diferença prática

|             | Evento ao vivo                    | Canal linear                                        |
| ----------- | --------------------------------- | --------------------------------------------------- |
| PRS         | `GetLivePlaybackResources`        | `GetLiveLinearPlaybackResources`                    |
| Catálogo    | `videoMaterialType=LiveStreaming` | idem, com `channelID`/`scheduled`                   |
| Lookback    | `maxLiveLookback: PT3H`           | `linearRestrictions` + `liveSchedule`               |
| Entitlement | assinatura/compra                 | `benefit: globopaytvbr`, `THIRD_PARTY_SUBSCRIPTION` |

## 7. Manifests, CDN e DRM

- Formato: **DASH** (`mpd`), vídeo **H.264**, DRM **CENC/Widevine**, áudio AAC estéreo
  (faixa `pt-br_dialog_0`).
- O MPD do VOD vem com token no caminho:
  `https://abs…vod-dash.main.amazon.pv-cdn.net/dm/3$0CiEI…/ww_gru/<shard>/<uuid>_corrected.mpd?amznDtid=AOAGZA014O5RE&amznPN=xp&amznPV=ATVWebPlayerSDK-1.0.246461.0&encoding=segmentBase`
- O MPD de linear/live carrega `$T$<base64>` no próprio caminho, emitido pelo PRS:
  `https://a60live-pv-ta-enf-amazon.akamaized.net/$T$2D3Rh…/gru-nitro/live/clients/dash-sd/enc/…/cenc-sd.mpd`.
- `encoding=segmentBase` pede o MPD com `SegmentBase` (init + index), não lista de segmentos.
- Failover: `cloudfront` → `akamai` no VOD; live usa CloudFront, Akamai e Fastly
  (`live-pv-ta-enf.amazon.fastly-edge.com`).
- Chaves: `widevineServiceCertificate` (certificado de serviço) + `licenseChallenge` (CDM) →
  `widevineLicense.license`. `keyMetadata` mostra **2 chaves** (dual key: vídeo/áudio).
- Política de licença observada: `licenseDuration` e `playbackDuration` ≈ **72 h**.
- Cache: manifest TTL até `PT360H`, mídia `PT720H`, settings `PT2H` com callback de refresh.

## 8. Telemetria (não bloqueia playback)

| Endpoint                                               | Host                                          | Uso                             |
| ------------------------------------------------------ | --------------------------------------------- | ------------------------------- |
| `GET /rd/uedata`                                       | `fls-na.amazon.com`, `www.amazon.com.br`      | Beacon de performance de página |
| `POST /cdp/usage/Clickstream`                          | `atv-ps`                                      | Cliques/navegação               |
| `POST /cdp/usage/ClientsideImpression`                 | `atv-ps`                                      | Impressões de card              |
| `POST /cdp/usage/ReportEvent`                          | `atv-ps`                                      | Eventos do player               |
| `POST /cdp/insights/reportEvent/v1/dvwebnode`          | `atv-ps`                                      | Insights do node web            |
| `POST /events/com.amazon.eel.pv.xpplayer.prod`         | `unagi-na.amazon.com`                         | CSM do player                   |
| `POST /v2/metric-batch`                                | `*.minerva.devices.a2z.com`                   | Métricas de device              |
| `GET /Bootstrap/AV20260921`, `POST /Events/AV20180101` | `global.telemetry.insights.video.a2z.com`     | Telemetria de vídeo             |
| `POST /`                                               | `prod.us-east-1.sonar.prime-video.amazon.dev` | Sonar (diagnóstico)             |

## 9. O que dá e o que não dá para reimplementar

**Dá:**

- Montar o catálogo nativo com `GET /api/enrichNav` (trilho) e
  `POST /api/getLandingPage` (fileiras). Convidado funciona sem cookie; sessão
  colada em Ajustes entra no header `Cookie` via cofre `prime_cookie`.
- Ler ids (`amzn1.dv.gti.*`), capas, sinopse e o link oficial `/detail/{id}`.
- Trocar de destino pela chave `pageType:pageId` (ex. `home:home`, `merch:mgForYou`).

**Não dá (sem clonar a Amazon):**

- **`playbackEnvelope`** — blob opaco (`MDJ8…` / JWE `plenv+jwe`) gerado pelo JS do player,
  amarrado a device + título + sessão. Não é derivável dos campos públicos; o PRS rejeita
  envelope inválido.
- **`sessionHandoffToken`** — JWE `shof+jwe`, `A256KW`/`A256CBC-HS512`, `kid a2z+pp_enc+shoff_…`.
  Só o servidor abre.
- **`licenseChallenge`** — desafio do CDM Widevine. Sem CDM real não há challenge; sem
  challenge não há licença; sem licença o CENC não decifra.
- **`sessionToken`** do PES — JWE `stokn+jws` rotacionado a cada callback.

Ou seja: o caminho de reproduce é do player oficial. Um cliente de terceiros que quisesse
tocar o conteúdo teria que reproduzir o envelope, o handoff e o licenciamento — isto é,
clonar o DRM da Amazon, o que está fora do escopo deste projeto (e dos termos de uso).

## 10. Como o OpenFlix usa isso hoje

Catálogo nativo 10-foot (sem webview, sem `#primeStage`):

- `src/primeApi.mjs` + `src-tauri/src/prime_api.rs`: allowlist `GET /api/enrichNav` e
  `POST /api/getLandingPage`. No Tauri o comando `prime_request` faz o HTTP com reqwest
  (cookie do cofre, UA Chrome, `Accept-Language: pt-BR`). No preview web cai no `fetch`.
- `src/primeNav.mjs`: `EnrichNavOutput` → destinos. Chrome estático na frente:
  `home:home` (Início) e `home:Sports` (Esportes, rota `/sports`). O resto vem de
  `categoryGroups.subNodes` (`swiftPageType`/`swiftPageId`). GET_CATEGORIES não
  devolve as abas do chrome (Filmes/Séries/Esportes/TV ao vivo).
- `src/primeLandingForm.mjs` + `src/primeLanding.mjs`: form com schemes
  `desktopOSX` / `web-decoration-gti-v4` / `web-features-v6` / `web-explore-v48` e
  `GetLandingPageOutput` → fileiras de cards (`titleId`, capa, ano, sinopse, `href`).
- `web/primeView.mjs`: trilho à esquerda, fileiras à direita, overlay de ficha,
  `Assistir no app` / `Abrir no navegador`. D-pad em `src/primeFocus.mjs` (Enter no
  detalhe = assistir).
- Cookie opcional em Ajustes (`web/primeSession.mjs`, conta `prime_cookie`). Sem cookie
  o BFF ainda devolve a loja de convidado (home / Feito para você / Esportes
  `pageType=home&pageId=Sports`). Eventos usam `liveInfo.timeBadge`; ligas sem
  `titleID` entram pelo `impressionId`.
- **Login:** `Entrar no Prime Video` abre `https://www.primevideo.com/` num
  `WebviewWindow` do app (`src-tauri/src/prime_window.rs`, label `prime-oficial`). O
  formulário, o MFA e o captcha são os da Amazon; nenhuma senha passa pelo OpenFlix. A
  janela usa o data store persistente do WKWebView, então a sessão sobrevive ao restart.
- **Sessão:** `Usar sessão deste app` chama `prime_session_cookie`, que lê o jar do próprio
  webview (`Webview::cookies()`), mantém só domínio `primevideo.com` (nada de `.amazon.com`)
  e grava o header no cofre 0600. É o mesmo cookie que o catálogo nativo usa. `Sair` limpa o
  webview (`clear_all_browsing_data`) e apaga a entrada do cofre.
- **Player:** `Assistir no app` abre `https://www.primevideo.com/detail/{titleId}` na mesma
  janela (`prime_open_player`, allowlist de host https). O player oficial da Amazon toca o
  DASH/CENC dentro do OpenFlix; `Abrir no navegador` é o fallback (`prime_open_external`).
- **Playback próprio:** fora de escopo. O OpenFlix não pede PRS, PES nem licença Widevine,
  não monta `playbackEnvelope` e não abre `sessionHandoffToken` — esse caminho exigiria
  clonar o DRM da Amazon, o que continua vetado neste projeto.

## 11. Evidências na captura

| Request id | Endpoint                                            | O que mostra                                     |
| ---------- | --------------------------------------------------- | ------------------------------------------------ |
| 2117967    | `POST /api/getLandingPage`                          | Form completo + `GetLandingPageOutput`           |
| 2174460    | `POST /api/enrichItemMetadata`                      | `metadataToEnrich` + `titleIDsToEnrich`          |
| 2174441    | `GET /api/enrichNav`                                | `EnrichNavOutput` com `categoryGroups`           |
| 2174465    | `GET /cdp/usage/GetAppStartupConfig`                | Território/device/customer                       |
| 2178153    | `GET /acm/GetConfiguration/WebClient`               | `customerID`, `timeToRefreshInSeconds`           |
| 2174560    | `POST /playback/prs/GetVodPlaybackResources`        | Envelope, handoff, playlist de 15 s              |
| 2174694    | `POST /playback/prs/GetVodPlaybackResources`        | Mesmo fluxo, outro título                        |
| 2165167    | `POST /playback/prs/GetLivePlaybackResources`       | Lookback 3 h, 6 urlSets, SYE                     |
| 2153977    | `POST /playback/prs/GetLiveLinearPlaybackResources` | Canal linear                                     |
| 2174782    | `POST /cdp/playback/pes/StartSession`               | `sessionHandoff` + `streamIntent`                |
| 2171781    | `POST /cdp/playback/pes/UpdateSession`              | `eventType: PLAY`, token rotacionado             |
| 2172196    | `POST /cdp/playback/pes/StopSession`                | `eventType: STOP`                                |
| 2153986    | `POST /playback/drm-linear/GetWidevineLicense`      | Challenge → licença + políticas                  |
| 2172231    | `POST /cdp/catalog/GetPlaybackResources`            | `Widevine2License` + `keyIds`                    |
| 2172215    | `POST /cdp/catalog/GetPlaybackResources`            | `desiredResources` completo + `errorsByResource` |
| 2172239    | `POST /cdp/catalog/GetPlaybackResources`            | `urlSets` + `liveSchedule` + entitlement         |
| 2174762    | `GET *.pv-cdn.net/…mpd`                             | MPD VOD com `encoding=segmentBase`               |
| 2174812    | `GET *.akamaized.net/$T$…/cenc-sd.mpd`              | MPD linear com token no caminho                  |

Achado registrado no Network Listener: **#1**, evidências `2174560`, `2172197`, `2153975`.

## 12. Limitações deste mapa

- Só o que aquela sessão fez: sem PRS de VOD completo (só trailers de ~15 s), sem compra,
  aluguel, download offline, perfil infantil, nem troca de faixa de áudio/legenda em execução.
- Sem os corpos de `atvweb-player-config`, `xpPlayerconfigs`, `AppResiliency`,
  `GetWeblabTreatment` e `UpdateStream` (não foram abertos; só se sabe método/rota/status).
- Sem `Cookie`/`Set-Cookie`: o mecanismo de sessão não está documentado aqui.
- Endpoints privados e não versionados: qualquer mudança da Amazon quebra o mapa.
