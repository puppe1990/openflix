# YouTube Innertube — mapa dos endpoints observados

Mapa do que o Chrome logado chama em `www.youtube.com/youtubei/v1` para home, busca e
player. Levantado em **08/11/2026** a partir da sessão do Network Listener (browse, search,
player, next, guide, account_menu). Não é documentação do YouTube: é o que o cliente WEB
fez naquela sessão. O player de mídia tenta **ANDROID** (itag 18 muxed `ftypmp42`),
cai no **IOS** se vier `LOGIN_REQUIRED` de bot e no **WEB** assinado (SAPISIDHASH)
se os dois clientes de app continuarem `logged_in=0`. **WEB_REMIX fica de fora**.

## 1. Hosts

| Host                  | Papel                                   |
| --------------------- | --------------------------------------- |
| `www.youtube.com`     | Innertube WEB (`/youtubei/v1/*`) e HTML |
| `accounts.google.com` | Login (SetSID → cookies `.youtube.com`) |
| `*.googlevideo.com`   | Mídia (Range, sem Cookie)               |

## 2. Cliente

| Campo           | WEB (catálogo)                                   | ANDROID (`/player`)                                              | IOS (`/player` fallback)                   |
| --------------- | ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------ |
| `clientName`    | `WEB`                                            | `ANDROID`                                                        | `IOS`                                      |
| `clientVersion` | `2.20261105.05.01`                               | `20.10.4`                                                        | `20.10.4`                                  |
| `User-Agent`    | Chrome 155 macOS                                 | `com.google.android.youtube/20.10.4 (Linux; U; Android 11) gzip` | Chrome 155 macOS (não o UA do app Android) |
| `Authorization` | `SAPISIDHASH` (origem `https://www.youtube.com`) | ausente                                                          | ausente                                    |
| Cookie          | sessão YouTube (sem `__Host-*`)                  | o mesmo jar, sem SAPISIDHASH                                     | o mesmo jar, sem SAPISIDHASH               |

`hl=pt` `gl=BR`. Query `?prettyPrint=false`.

## 3. Allowlist do OpenFlix

Só `POST`:

- `/youtubei/v1/browse`
- `/youtubei/v1/search`
- `/youtubei/v1/player`
- `/youtubei/v1/next`
- `/youtubei/v1/guide`
- `/youtubei/v1/account/account_menu`

Fora: `log_event`, `updated_metadata`, `heartbeat`, `music/*`.

## 4. Destinos chrome (browseId)

| browseId          | Rótulo     |
| ----------------- | ---------- |
| `FEwhat_to_watch` | Início     |
| `FEsubscriptions` | Inscrições |
| `FEhistory`       | Histórico  |
| `FElibrary`       | Biblioteca |

`FEtrending` (“Em alta”) o YouTube retirou em jul/2025: `POST /browse` com esse
browseId devolve HTTP 400 `INVALID_ARGUMENT` com ou sem sessão. O HTML de
`/feed/trending` hoje serve o Início.

## 5. Player

ANDROID `/player` devolve `streamingData.formats` com url direta no itag 18
(`video/mp4`, 360p). Live não tem itag 18: usa `streamingData.hlsManifestUrl`
(`https://manifest.googlevideo.com/.../index.m3u8`). Se o ANDROID responder
`LOGIN_REQUIRED` (“Faça login para confirmar que você não é um bot”), o
OpenFlix chama de novo com cliente **IOS** (UA Chrome, `deviceModel`
`iPhone16,2`) e, se o IOS também vier `LOGIN_REQUIRED` com `logged_in=0`,
com cliente **WEB** assinado (SAPISIDHASH, origem `https://www.youtube.com`).
WEB VOD logado devolve itag 18 com url direta; live devolve `hlsManifestUrl`.
SAPISIDHASH no ANDROID/IOS é `INVALID_ARGUMENT` com sessão. O proxy local `http://127.0.0.1:{port}/video/{id}.mp4`
encaminha `Range` para o googlevideo (não baixa o arquivo inteiro). Live aponta
para `/video/{id}.m3u8`; o proxy reescreve a playlist para `/ytg?u=` e o player
toca HLS nativo do WKWebView (`video.src` no loopback, o mesmo caminho do itag 18).
O rewrite põe o maior `BANDWIDTH` primeiro — o AVPlayer começa no primeiro STREAM-INF e o YouTube manda 144p. Portal XC remoto continua no hls.js. `/ytg` só trata como playlist o path que **termina** em `.m3u8`
— o `seg.ts` da live traz `/index.m3u8/` no meio da URL. URLs WEB de `videoplayback` (itag 18 e `seg.ts`) trazem `n` cru: sem o transform o CDN responde 403 vazio e o `<video>` cai em `MEDIA_ERR_DECODE` (código 3). O proxy resolve o n-sig com yt-dlp/ejs 0.8.0 no QuickJS (rquickjs) antes do GET; o download do player JS em `www.youtube.com` vai em HTTP/1.1 (`http1_only`) porque o HTTP/2 do rustls cai em stream error. 403 refresca o `/player`
uma vez. TTL da URL ~10 min.

## 6. Cookies que vão ao Innertube

`SID`, `HSID`, `SSID`, `APISID`, `SAPISID`, `__Secure-1PSID`, `__Secure-3PSID`,
`__Secure-1PAPISID`, `__Secure-3PAPISID`, `__Secure-1PSIDTS`, `__Secure-3PSIDTS`,
`SIDCC`, `__Secure-1PSIDCC`, `__Secure-3PSIDCC`, `VISITOR_INFO1_LIVE`,
`VISITOR_PRIVACY_METADATA`, `PREF`, `YSC`, `__Secure-YEC`, `LOGIN_INFO`.

`__Host-*` (GAPS / PLSID) **não** vai: deixa o browse anônimo (provado no OurTube em 05/11/2026).
