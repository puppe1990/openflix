use tauri::webview::{Cookie, PageLoadEvent};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::secrets;
use crate::youtube_api::{COOKIE_ACCOUNT, ORIGIN};

const WINDOW_LABEL: &str = "youtube-oficial";
const WINDOW_TITLE: &str = "YouTube — OpenFlix";
// WKWebView sem o token "Safari" faz o login da Google recusar o browser.
const SAFARI_UA: &str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const LOGIN_URL: &str =
    "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F";
const HOSTS: [&str; 5] = [
    "www.youtube.com",
    "youtube.com",
    "m.youtube.com",
    "accounts.youtube.com",
    "accounts.google.com",
];
const AUTH_COOKIE_NAMES: [&str; 20] = [
    "SID",
    "HSID",
    "SSID",
    "APISID",
    "SAPISID",
    "__Secure-1PSID",
    "__Secure-3PSID",
    "__Secure-1PAPISID",
    "__Secure-3PAPISID",
    "__Secure-1PSIDTS",
    "__Secure-3PSIDTS",
    "SIDCC",
    "__Secure-1PSIDCC",
    "__Secure-3PSIDCC",
    "VISITOR_INFO1_LIVE",
    "VISITOR_PRIVACY_METADATA",
    "PREF",
    "YSC",
    "__Secure-YEC",
    "LOGIN_INFO",
];

/// Só https em youtube.com / accounts.google.com (o login da Google mora aí).
pub fn allowed_url(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    url.scheme() == "https" && matches!(url.host_str(), Some(host) if HOSTS.contains(&host))
}

/// Header Cookie só com os nomes da sessão YouTube, sem __Host-*.
pub fn cookie_header(cookies: &[Cookie<'static>]) -> String {
    let mut picked = Vec::new();
    for name in AUTH_COOKIE_NAMES {
        if let Some(cookie) = cookies.iter().find(|item| item.name() == name) {
            if !cookie.value().is_empty() {
                picked.push(format!("{name}={}", cookie.value()));
            }
        }
    }
    picked.join("; ")
}

/// Login real: LOGIN_INFO ou SAPISID. SID/VISITOR sozinhos deixam o Innertube anônimo.
pub fn session_ready(header: &str) -> bool {
    header.split(';').any(|part| {
        let Some((name, value)) = part.trim().split_once('=') else {
            return false;
        };
        (name == "LOGIN_INFO" || name == "SAPISID") && !value.is_empty()
    })
}

/// Captura só depois do Google devolver o usuário em youtube.com.
pub fn capture_page_ok(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    url.scheme() == "https"
        && matches!(
            url.host_str(),
            Some("www.youtube.com" | "youtube.com" | "m.youtube.com")
        )
}

fn capture_if_ready(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    let url = window.url().map_err(|error| {
        format!("sessão do youtube recusada: recebido {error}, esperado url da página")
    })?;
    if !capture_page_ok(url.as_str()) {
        return Ok(());
    }
    let cookies = window.cookies().map_err(|error| {
        format!("sessão do youtube recusada: recebido {error}, esperado jar do webview")
    })?;
    let header = cookie_header(&cookies);
    if !session_ready(&header) {
        return Ok(());
    }
    secrets::set(app, COOKIE_ACCOUNT, &header)?;
    let _ = app.emit("youtube-session", true);
    Ok(())
}

fn check_url(raw: &str) -> Result<Url, String> {
    if !allowed_url(raw) {
        return Err(format!(
            "url do youtube recusada: recebido {raw}, esperado {ORIGIN}..."
        ));
    }
    Url::parse(raw).map_err(|error| {
        format!("url do youtube recusada: recebido {error}, esperado URL absoluta")
    })
}

fn ensure_window(app: &AppHandle, target: Url) -> Result<WebviewWindow, String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = capture_if_ready(app, &window);
        return Ok(window);
    }
    WebviewWindowBuilder::new(app, WINDOW_LABEL, WebviewUrl::External(target))
        .title(WINDOW_TITLE)
        .user_agent(SAFARI_UA)
        .inner_size(520.0, 740.0)
        .center()
        .on_page_load(|webview, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            if !capture_page_ok(payload.url().as_str()) {
                return;
            }
            let app = webview.app_handle().clone();
            let _ = capture_if_ready(&app, &webview);
        })
        .build()
        .map_err(|error| format!("janela do youtube recusou: recebido {error}, esperado webview"))
}

/// Abre (ou reusa) a janela oficial do YouTube; o login acontece lá dentro.
pub fn sign_in(app: &AppHandle) -> Result<(), String> {
    ensure_window(app, check_url(LOGIN_URL)?).map(|_| ())
}

/// Lê os cookies da janela oficial, guarda a sessão YouTube no cofre e devolve o header.
pub fn session_cookie(app: &AppHandle) -> Result<String, String> {
    let window = app.get_webview_window(WINDOW_LABEL).ok_or_else(|| {
        "sessão do youtube recusada: recebido janela fechada, esperado login em Entrar no YouTube"
            .to_string()
    })?;
    let cookies = window.cookies().map_err(|error| {
        format!("sessão do youtube recusada: recebido {error}, esperado jar do webview")
    })?;
    let header = cookie_header(&cookies);
    if header.is_empty() {
        return Err(
            "sessão do youtube recusada: recebido jar sem cookie de sessão, esperado login concluído"
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
            format!("sessão do youtube recusada: recebido {error}, esperado limpar o webview")
        })?;
    }
    secrets::remove(app, COOKIE_ACCOUNT)
}

#[cfg(test)]
mod tests {
    use super::{allowed_url, capture_page_ok, cookie_header, session_ready, SAFARI_UA};
    use tauri::webview::Cookie;

    #[test]
    fn safari_ua_tem_token_que_o_login_google_exige() {
        assert!(SAFARI_UA.contains("Safari/"));
        assert!(SAFARI_UA.contains("Version/"));
    }

    #[test]
    fn allowlist_youtube_e_accounts_google() {
        assert!(allowed_url("https://www.youtube.com/"));
        assert!(allowed_url(
            "https://accounts.google.com/ServiceLogin?service=youtube"
        ));
        assert!(allowed_url("https://m.youtube.com/watch?v=dQw4w9WgXcQ"));
        assert!(!allowed_url("http://www.youtube.com/"));
        assert!(!allowed_url("https://www.youtube.com.exemplo.net/"));
        assert!(!allowed_url(
            "https://rr1---sn.googlevideo.com/videoplayback"
        ));
        assert!(!allowed_url("javascript:alert(1)"));
    }

    #[test]
    fn session_ready_pede_login_info_ou_sapisid() {
        assert!(!session_ready("SID=abc; VISITOR_INFO1_LIVE=v1"));
        assert!(session_ready("SAPISID=xyz; SID=abc"));
        assert!(session_ready("LOGIN_INFO=login; VISITOR_INFO1_LIVE=v1"));
        assert!(!session_ready(""));
    }

    #[test]
    fn capture_page_ok_so_youtube_depois_do_login() {
        assert!(capture_page_ok("https://www.youtube.com/"));
        assert!(capture_page_ok("https://m.youtube.com/feed/subscriptions"));
        assert!(capture_page_ok("https://youtube.com/"));
        assert!(!capture_page_ok(
            "https://accounts.google.com/ServiceLogin?service=youtube"
        ));
        assert!(!capture_page_ok("http://www.youtube.com/"));
    }

    #[test]
    fn cookie_header_so_nomes_da_sessao() {
        let cookies = vec![
            Cookie::parse("SAPISID=abc; Domain=.youtube.com; Path=/").unwrap(),
            Cookie::parse("__Host-GAPS=zzz; Domain=accounts.google.com; Path=/").unwrap(),
            Cookie::parse("SID=sid; Domain=.google.com; Path=/").unwrap(),
            Cookie::parse("VISITOR_INFO1_LIVE=v1; Domain=.youtube.com; Path=/").unwrap(),
        ];
        let header = cookie_header(&cookies);
        assert!(header.contains("SAPISID=abc"));
        assert!(header.contains("SID=sid"));
        assert!(header.contains("VISITOR_INFO1_LIVE=v1"));
        assert!(!header.contains("__Host-GAPS"));
    }
}
