# Casa HY300 — launcher Android 10-foot

Data: 2026-11-10
Status: aprovado (conversa + companion; Matheus pediu executar na hora)

## Problema

A home do HY300 é o launcher TXCZ (fundo azul, tiles arco-íris, atalho Netflix morto). O pedido é o **SO Android**: botão Home do controle abre uma home tipo Samsung Tizen. OpenFlix continua um app.

## Decisões

- Layout Samsung: herói + trilhos + dock redondo.
- Herói = resume se `history[0]`; senão `favs[0]`; senão cartaz frio OpenFlix.
- Dock completo: OpenFlix, YouTube, Prime, Play, HDMI, Arquivos, Ajustes, Aplicações.
- Mesmo APK `com.lifetv.app`, duas activities.
- Mac Tauri: Início atual. Casa só no APK / `?casa=1`.
- Casa não toca vídeo. Assistir agora / OF / card abre `MainActivity`.
- Voltar no Início do OpenFlix chama `OpenFlixHouse.leave()` e volta à Casa.
- Home no controle sempre traz `CasaActivity` (`singleTask`).
- App ausente some do dock. Launch falhou: toast 3s, fica na Casa.
- Lupa fora do D-pad no v1.
- HDMI só entra no dock se o Java achar intent; a TXCZ trata HDMI como view interna, não activity.

## Activities

| Activity       | Intent                     | URL                                                               |
| -------------- | -------------------------- | ----------------------------------------------------------------- |
| `CasaActivity` | MAIN + HOME + DEFAULT      | `http://openflix.local/casa.html`                                 |
| `MainActivity` | MAIN + LAUNCHER + LEANBACK | `http://openflix.local/index.html` (+ `?play=` / `?screen=prime`) |

Depois do install: `cmd package set-home-activity com.lifetv.app/.CasaActivity`. TXCZ permanece instalada.

## Domínio (`src/casa.mjs`)

- `casaHero({ history, favs })`
- `casaRails({ history, favs })` — Continuar = history; Recomendados = favs, senão history.slice(1)
- `CASA_DOCK` + `visibleDock({ packages, hdmi })`
- `createCasaShell()` zona inicial `hero`
- `handleCasaKey(shell, key, model)` — zonas `tabs` → `hero` → `rails` → `dock`; `apps` é overlay
- `shouldLeaveToCasa(shell, key)` — Escape no Início do OpenFlix

## Dock (actions)

- OpenFlix → `MainActivity`
- YouTube → `com.google.android.youtube.tv`
- Prime → `MainActivity?screen=prime`
- Play → `com.android.vending`
- HDMI → se resolvido
- Arquivos → `com.rockchips.mediacenter`
- Ajustes → `com.android.tv.settings` (no aparelho é a Configurações TXCZ)
- Aplicações → gaveta LEANBACK/LAUNCHER sem a própria Casa

## D-pad (Casa)

Foco inicial: herói (Assistir agora). Esquerda/direita na zona. Cima/baixo troca zona. Enter confirma. Escape na Casa: fecha gaveta Apps; senão no-op (não finish, não TXCZ).

## Bridge Java

`OpenFlixHouse.read()` (já existe), `packages()`, `launch(json)`, `leave()`, `bootIntent()`.

## Fora

- Remount do super
- Reescrever Início Tauri
- Motor de recomendação
- HDMI via REA da TXCZ neste corte
- Casa editável (Personalizado)

## Teste

`npm test` — `test/casa.test.mjs` + faker. Preview Mac `http://127.0.0.1:8792/web/casa.html`. Projetor: Home → Casa; Enter OF → OpenFlix; Voltar → Casa.
