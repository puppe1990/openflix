# OpenFlix — regras pra agentes

Núcleo de catálogo/player para playlists **próprias** Xtream/M3U. Spec veio do APK LIFE TV (white-label FlexTV). Sem VPN, MAC cloud, Unsafe TLS ou dump de segredo.

## Comandos

```bash
npm ci --include=dev   # o ambiente tem NODE_ENV=production; sem a flag as devDeps somem
npm test            # node --test + @faker-js/faker
npm run lint
npm run format:check
npm run css         # Tailwind CLI → web/style.css
npm run ci
npm run dev         # css + http://127.0.0.1:8792/web/  (não use 8765)
npm run tauri:dist  # web/ + src/ → .tauri-dist (frontendDist do Tauri)
npm run tauri:dev   # janela Tauri 2 1920x1080
npm run tauri:app   # target-app/OpenFlix.app (ad-hoc local)
```

Pre-commit: lint-staged + `npm test`. CI GitHub Actions = `npm run ci` + `cargo test --bins`.
Release: tag `vX.Y.Z` dispara `.github/workflows/release.yml` (Mac aarch64/x86_64, Windows, Linux).

Mapa dos endpoints oficiais do Prime Video (loja, PRS/PES, DRM, CDN):
`docs/prime-video-endpoints.md`.

Mapa do Innertube YouTube (WEB catálogo + ANDROID `/player` itag 18, IOS se `LOGIN_REQUIRED`):
`docs/youtube-innertube-endpoints.md`.

## Configuração (sem hardcode)

- Identidade do app (nome, `identifier`, versão) mora em `src-tauri/tauri.conf.json`;
  `scripts/build-macos-app.sh` deriva `.app`, binário, plist e versão dela.
- Caminhos de dados usam `app.path().app_config_dir()` (o `identifier` decide), não string fixa.
  Arquivos: `seed.json`, `secrets.json`, `life-tv.sqlite`.
- Player externo: `LIFE_TV_PLAYER` (binário, padrão `mpv`) e `LIFE_TV_PLAYER_APP`
  (fallback via `open -a`, padrão `IINA`).
- UI/persistência: `web/config.mjs` (marca, chaves de storage, conta do seed, nome padrão).
- Playlists/favs/resume no Tauri: sqlite `life-tv.sqlite` (0600) em `app.path().app_config_dir()`, tabela `kv`. Senhas continuam em `secrets.json`. Preview web segue no `localStorage`.

## Mapa do web/ (cada módulo < 200 linhas)

- `app.js` — wiring: atalhos, abas (inclui Ajustes internos), boot (não desenha nada).
- `session.mjs` — boot/seed/rotação de portal, catálogo e playlist.
- `catalogView.mjs` — home, abas e catálogo em duas colunas (categorias | itens).
- `playerView.mjs` — vídeo, resume, EPG, catch-up, PiP e player externo.
- `primeVideo.mjs` — atalho da aba: dispara o evento que abre a tela Prime.
- `primeClient.mjs` — GET `/api/enrichNav` e POST `/api/getLandingPage` (Tauri `prime_request` ou fetch). Trilho: Início + Esportes (`home:Sports`) + `categoryGroups`.
- `primeSession.mjs` — sessão no cofre (`prime_cookie`), sync do webview oficial e logout; sessionStorage no preview.
- `primeView.mjs` — catálogo nativo 10-foot: trilho, fileiras, detalhe, `handlePrimeKey`.
- `primeWindow.mjs` — login na janela oficial: `prime_sign_in`, `prime_open_external` (fallback).
- `primePane.mjs` — player oficial embutido: webview filho `prime-pane` sobre `#primePaneHost`.
- `youtubeVideo.mjs` — atalho da aba: dispara o evento que abre a tela YouTube.
- `youtubeClient.mjs` — POST Innertube (Tauri `youtube_request` só; preview recusa CORS). Trilho: Início / Inscrições / Histórico / Em alta.
- `youtubeSession.mjs` — sessão no cofre (`youtube_cookie`), sync do webview oficial e logout.
- `youtubeView.mjs` — catálogo nativo 10-foot: trilho, fileiras, detalhe, `handleYoutubeKey` (Enter toca no player OpenFlix).
- `youtubeWindow.mjs` — login na janela oficial: `youtube_sign_in` (a sessão grava sozinha no page-load).
- `render.mjs` — `renderAll()` a partir de `state`.
- `state.mjs` / `stores.mjs` / `bridge.mjs` / `dom.mjs` — estado, stores, Tauri/storage, helpers DOM.
- Núcleo puro e testado em `src/` (`primeApi`, `primeNav`, `primeLanding`, `primeLandingForm`, `primeCookie`, `primePlay`, `primePaneRect`, `primeFocus`, `settingsTabs`, `youtubeApi`, `youtubeNav`, `youtubeBrowse`, `youtubeSearch`, `youtubePlayer`, `youtubePlay`, `youtubeCookie`, `youtubeFocus`). Ajustes internos: Playlists (M3U), Streaming (XC), Prime Video e YouTube (login, sessão e cookie). Shell Tauri: `src-tauri/src/prime_api.rs` (allowlist, cookie do cofre), `prime_window.rs` (login oficial, jar de cookie, logout), `prime_pane.rs` (webview filho na janela principal), `youtube_api.rs` (Innertube WEB + ANDROID `/player`, IOS se `LOGIN_REQUIRED`), `youtube_window.rs` (login Google/YouTube, captura automática da sessão), `youtube_media.rs` (parser HLS/Range) e `youtube_proxy.rs` (Range mp4 + rewrite HLS em `127.0.0.1`). `primeView` e `youtubeView` têm teste; o resto das views valide rodando o app.

## Code style

- Functions: 4–20 linhas. Files: alvo 200–300, teto 500.
- Uma responsabilidade por módulo. Espelho `src/foo.mjs` ↔ `test/foo.test.mjs`.
- Nomes greppáveis. Evite `data`, `handler`, `Manager`, `utils`.
- JSDoc nos exports públicos. Sem TypeScript neste núcleo.
- Erro inclui valor recebido e forma esperada.
- Early returns. Máximo 2 níveis de indentação no fluxo.

## Tests

- Um comando: `npm test`. TDD: teste vermelho **antes** do domínio.
- Factories em `test/factories.mjs`; `faker.seed` por arquivo.
- Catálogos, logins e M3U vêm do faker (hosts `.net`/`.org` sintéticos). Sem HTTP real.
- Cada função nova ganha teste. Bugfix ganha regressão.
- UI 10-foot em `web/` importa `../src/`. Preview pela raiz do repo.

## Fora de escopo

- POST de MAC para `second_create_url`
- `libhax.so` / VPN
- Chaves TMDB / OpenSubtitles / CryptMtx
- Playlists que não sejam do usuário
