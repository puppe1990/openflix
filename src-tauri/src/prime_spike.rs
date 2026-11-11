//! Spike de validação do player nativo do Prime (dev): dirige a UI real
//! (aba Prime → card → "Assistir no app"), exercitando oráculo, licença
//! FairPlay e HUD no mesmo caminho do usuário. Só roda com
//! OPENFLIX_PRIME_SPIKE=1 — ferramenta de validação, não faz parte do app.
//!
//! Reporta pelo servidor HTTP do oráculo (a janela local não tem a capability
//! `prime_oracle_report`, que é só do pane remoto) usando o mesmo JSONL.

use tauri::{AppHandle, Manager};

use crate::prime_oracle;

/// Passos reportados no `prime-oracle.jsonl` como `kind: "spike"`.
const DRIVER: &str = r#"
(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const report = (step) =>
    fetch('__CAPTURE_BASE__/oracle', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'spike', at: Date.now(), step }),
    }).catch(() => {});
  const screen = () =>
    String(document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 240);
  const waitFor = async (selector, tries = 240) => {
    for (let index = 0; index < tries; index += 1) {
      const node = document.querySelector(selector);
      if (node) return node;
      await sleep(250);
    }
    throw new Error(`sem ${selector}`);
  };
  try {
    await report(
      `env secure=${globalThis.isSecureContext} eme=${typeof navigator.requestMediaKeySystemAccess} ua=${navigator.userAgent}`,
    );
    await report(
      `api: core=${typeof globalThis.__TAURI__?.core?.invoke} event=${typeof globalThis.__TAURI__?.event?.listen}`,
    );
    let events = 0;
    if (globalThis.__TAURI__?.event?.listen) {
      await globalThis.__TAURI__.event.listen('prime-oracle', () => {
        events += 1;
      });
      setTimeout(() => void report(`eventos: ${events}`), 25000);
    }
    const seen = new Set();
    setInterval(() => {
      const text = document.getElementById('error')?.textContent || '';
      if (text && !seen.has(text)) {
        seen.add(text);
        void report(`erro: ${text}`);
      }
    }, 2000);
    const invoke = globalThis.__TAURI__?.core?.invoke;
    try {
      const nav = await invoke('prime_request', { method: 'GET', path: '/api/enrichNav', body: null });
      await report(`nav ok ${String(nav).length}B`);
    } catch (error) {
      await report(`nav erro: ${error}`);
    }
    try {
      const form =
        'pageType=home&pageId=home&pageNumber=0&startIndex=0&pageSize=6&variant=desktopOSX&actionScheme=default&payloadScheme=default&decorationScheme=web-decoration-gti-v4&featureScheme=web-features-v6&dynamicFeatures=RecordingCardSupported&widgetScheme=web-explore-v48';
      const landing = await invoke('prime_request', {
        method: 'POST',
        path: '/api/getLandingPage',
        body: form,
      });
      await report(`landing ok ${String(landing).length}B`);
    } catch (error) {
      await report(`landing erro: ${error}`);
    }
    await report(`erro-box: ${document.getElementById('error')?.textContent || 'vazio'}`);
    const tab = await waitFor('#tab-prime');
    tab.click();
    await sleep(1500);
    await report(
      `prime-screen: ${document.getElementById('error')?.textContent || 'sem erro'} | ${screen()}`,
    );
    const dest = __SPIKE_DEST__;
    if (dest) {
      const rail = await waitFor(`[data-prime-dest="${dest}"]`);
      rail.click();
      await sleep(4000);
      await report(`dest ${dest} | ${screen()}`);
    }
    const cards = [...document.querySelectorAll('[data-prime-card]')];
    await report(
      `cards: ${cards
        .slice(0, 24)
        .map((node) => node.textContent.replace(/\s+/g, ' ').trim())
        .join(' | ')}`,
    );
    const wanted = __SPIKE_TITLE__;
    const preferred = cards.find((node) => node.textContent.includes(wanted));
    const card = preferred || (await waitFor('[data-prime-card]'));
    await report(`card: ${card.textContent.replace(/\s+/g, ' ').slice(0, 80)}`);
    card.click();
    await report('detail');
    const play = await waitFor('#primeDetailPlay');
    play.click();
    await report('play-clicked');
    const player = await waitFor('#player:not([hidden])', 240).catch(() => null);
    if (!player) {
      await report(`player não abriu | tela: ${screen()}`);
      return;
    }
    const video = player.querySelector('video');
    const startAt = Math.round(video?.currentTime || 0);
    await report(
      `player: ${player.innerText.replace(/\s+/g, ' ').slice(0, 180)} | paused=${video?.paused} ready=${video?.readyState} err=${video?.error?.code} dur=${Math.round(video?.duration || 0)} src=${String(video?.currentSrc || '').slice(0, 40)}`,
    );
    await sleep(6000);
    await report(
      `player depois: t=${Math.round(video?.currentTime || 0)} (start ${startAt}) paused=${video?.paused} ready=${video?.readyState}`,
    );
    await sleep(6000);
    await report(
      `player final: t=${Math.round(video?.currentTime || 0)} paused=${video?.paused} ready=${video?.readyState} w=${video?.videoWidth} h=${video?.videoHeight} frames=${video?.webkitDecodedFrameCount} dur=${Math.round(video?.duration || 0)}`,
    );
  } catch (error) {
    await report(`erro: ${error.message} | tela: ${screen()}`);
  }
})()
"#;

/// Espera a janela principal assentar e dirige o fluxo; erro só aparece no log.
pub fn run(app: AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(6));
        match drive(&app) {
            Ok(()) => eprintln!("spike do prime: driver injetado na janela principal"),
            Err(error) => eprintln!("spike do prime recusou: {error}"),
        }
    });
}

fn drive(app: &AppHandle) -> Result<(), String> {
    let base = prime_oracle::base_url()?;
    let title = std::env::var("OPENFLIX_PRIME_SPIKE_TITLE")
        .unwrap_or_else(|_| "We Live in Time".to_string());
    let quoted = serde_json::to_string(&title)
        .map_err(|error| format!("spike do prime recusado: recebido {error}, esperado JSON"))?;
    let dest = std::env::var("OPENFLIX_PRIME_SPIKE_DEST").unwrap_or_default();
    let dest_quoted = serde_json::to_string(&dest)
        .map_err(|error| format!("spike do prime recusado: recebido {error}, esperado JSON"))?;
    let script = DRIVER
        .replace("__CAPTURE_BASE__", &base)
        .replace("__SPIKE_TITLE__", &quoted)
        .replace("__SPIKE_DEST__", &dest_quoted);
    let webview = app.get_webview("main").ok_or_else(|| {
        "spike do prime recusado: recebido janela sem webview main, esperado shell Tauri"
            .to_string()
    })?;
    webview.eval(&script).map_err(|error| {
        format!("spike do prime recusado: recebido {error}, esperado eval na main")
    })
}
