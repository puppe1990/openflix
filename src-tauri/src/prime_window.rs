use std::process::Command;

use tauri::webview::Cookie;
use tauri::{AppHandle, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::secrets;

const WINDOW_LABEL: &str = "prime-oficial";
const WINDOW_TITLE: &str = "Prime Video — OpenFlix";
const COOKIE_ACCOUNT: &str = "prime_cookie";
const COOKIE_DOMAIN: &str = "primevideo.com";
const PRIME_ORIGIN: &str = "https://www.primevideo.com/";
// WKWebView manda um UA sem token "Safari"; a loja da Amazon recusa esse UA.
pub(crate) const SAFARI_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const HOSTS: [&str; 2] = ["primevideo.com", "www.primevideo.com"];

/// Só https em primevideo.com: o player oficial roda aí, nada de API/DRM própria.
pub fn allowed_url(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    url.scheme() == "https" && matches!(url.host_str(), Some(host) if HOSTS.contains(&host))
}

fn cookie_domain_belongs(domain: &str) -> bool {
    let host = domain.trim_start_matches('.').to_ascii_lowercase();
    host == COOKIE_DOMAIN || host.ends_with(&format!(".{COOKIE_DOMAIN}"))
}

/// Header Cookie com os pares de primevideo.com, em ordem de nome e sem repetição.
pub fn cookie_header(cookies: &[Cookie<'static>]) -> String {
    let mut rows: Vec<(&str, &str)> = cookies
        .iter()
        .filter(|cookie| cookie.domain().is_some_and(cookie_domain_belongs))
        .map(|cookie| (cookie.name(), cookie.value()))
        .collect();
    rows.sort_unstable();
    rows.dedup_by(|left, right| left.0 == right.0);
    rows.iter()
        .map(|(name, value)| format!("{name}={value}"))
        .collect::<Vec<String>>()
        .join("; ")
}

fn check_url(raw: &str) -> Result<Url, String> {
    if !allowed_url(raw) {
        return Err(format!(
            "url do prime recusada: recebido {raw}, esperado {PRIME_ORIGIN}..."
        ));
    }
    Url::parse(raw)
        .map_err(|error| format!("url do prime recusada: recebido {error}, esperado URL absoluta"))
}

fn ensure_window(app: &AppHandle, target: Url) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window.navigate(target).map_err(|error| {
            format!("janela do prime recusou: recebido {error}, esperado navegação")
        })?;
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(window);
    }
    WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::External(target))
        .title(WINDOW_TITLE)
        .user_agent(SAFARI_UA)
        .inner_size(1600.0, 900.0)
        .center()
        .build()
        .map_err(|error| format!("janela do prime recusou: recebido {error}, esperado webview"))
}

/// Abre (ou reusa) a janela oficial do Prime Video; o login acontece lá dentro.
pub fn sign_in(app: &AppHandle) -> Result<(), String> {
    ensure_window(app, check_url(PRIME_ORIGIN)?).map(|_| ())
}

/// Abre o detalhe do título na janela oficial, onde o player da Amazon toca.
pub fn open_player(app: &AppHandle, raw: &str) -> Result<(), String> {
    ensure_window(app, check_url(raw)?).map(|_| ())
}

/// Fallback: mesmo título no navegador padrão do sistema.
pub fn open_external(raw: &str) -> Result<(), String> {
    let url = check_url(raw)?;
    match Command::new("open").arg(url.as_str()).status() {
        Ok(status) if status.success() => Ok(()),
        _ => Err(format!(
            "navegador recusou: recebido {raw}, esperado abrir no navegador padrão"
        )),
    }
}

/// Lê os cookies da janela oficial, guarda só os de primevideo.com no cofre e devolve o header.
pub fn session_cookie(app: &AppHandle) -> Result<String, String> {
    let window = app.get_webview_window(WINDOW_LABEL).ok_or_else(|| {
        "sessão do prime recusada: recebido janela fechada, esperado login em Entrar no Prime Video"
            .to_string()
    })?;
    let cookies = window.cookies().map_err(|error| {
        format!("sessão do prime recusada: recebido {error}, esperado jar do webview")
    })?;
    let header = cookie_header(&cookies);
    if header.is_empty() {
        return Err(
            "sessão do prime recusada: recebido jar sem cookie de primevideo.com, esperado login concluído"
                .to_string(),
        );
    }
    secrets::set(app, COOKIE_ACCOUNT, &header)?;
    Ok(header)
}

/// Fecha a sessão no webview oficial e apaga o cookie do cofre.
pub fn sign_out(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window.clear_all_browsing_data().map_err(|error| {
            format!("sessão do prime recusada: recebido {error}, esperado limpar o webview")
        })?;
    }
    secrets::remove(app, COOKIE_ACCOUNT)
}

#[cfg(test)]
mod tests {
    use super::{allowed_url, cookie_header};
    use tauri::webview::Cookie;

    #[test]
    fn allowlist_so_primevideo_https() {
        assert!(allowed_url(
            "https://www.primevideo.com/detail/amzn1.dv.gti.x"
        ));
        assert!(allowed_url("https://primevideo.com/"));
        assert!(!allowed_url("http://www.primevideo.com/"));
        assert!(!allowed_url("https://www.primevideo.com.exemplo.net/"));
        assert!(!allowed_url("javascript:alert(1)"));
        assert!(!allowed_url("https://atv-ps.primevideo.com/playback/prs/x"));
    }

    #[test]
    fn cookie_header_so_primevideo_e_ordenado() {
        let cookies = vec![
            Cookie::parse("session-id=abc; Domain=.primevideo.com; Path=/").unwrap(),
            Cookie::parse("ubid-main=zzz; Domain=.amazon.com; Path=/").unwrap(),
            Cookie::parse("at-main=1; Domain=www.primevideo.com; Path=/detail").unwrap(),
        ];
        assert_eq!(cookie_header(&cookies), "at-main=1; session-id=abc");
    }

    #[test]
    fn cookie_header_vazio_sem_primevideo() {
        let cookies = vec![Cookie::parse("ubid-main=zzz; Domain=.amazon.com").unwrap()];
        assert_eq!(cookie_header(&cookies), "");
    }
}
