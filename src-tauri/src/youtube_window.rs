use tauri::webview::{Cookie, PageLoadEvent};
use tauri::{AppHandle, Emitter, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::youtube_api::ORIGIN;
use crate::youtube_bind;

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
#[allow(dead_code)]
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
#[allow(dead_code)]
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
#[allow(dead_code)]
pub fn session_ready(header: &str) -> bool {
    header.split(';').any(|part| {
        let Some((name, value)) = part.trim().split_once('=') else {
            return false;
        };
        (name == "LOGIN_INFO" || name == "SAPISID") && !value.is_empty()
    })
}

/// Captura no Google ou no YouTube: o SAPISID nasce em accounts.google.com.
pub fn capture_page_ok(raw: &str) -> bool {
    allowed_url(raw)
}

fn cookie_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(WINDOW_LABEL)
        .or_else(|| app.get_webview_window("main"))
}

fn collect_cookies(app: &AppHandle) -> Result<String, String> {
    let Some(window) = cookie_window(app) else {
        return Ok("pending".to_string());
    };
    let cookies = window.cookies().map_err(|error| {
        format!("sessão do youtube recusada: recebido {error}, esperado jar do webview")
    })?;
    let pairs: Vec<(String, String)> = cookies
        .iter()
        .map(|cookie| (cookie.name().to_string(), cookie.value().to_string()))
        .collect();
    match youtube_bind::extract_cookie_auth(&pairs) {
        Some(auth) => {
            youtube_bind::store_auth(app, &auth)?;
            Ok("authorized".to_string())
        }
        None => Ok("pending".to_string()),
    }
}

fn capture_if_ready(app: &AppHandle, window: &WebviewWindow) -> Result<(), String> {
    let url = window.url().map_err(|error| {
        format!("sessão do youtube recusada: recebido {error}, esperado url da página")
    })?;
    if !capture_page_ok(url.as_str()) {
        return Ok(());
    }
    if collect_cookies(app)? == "authorized" {
        let _ = app.emit("youtube-session", true);
    }
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
            if !allowed_url(payload.url().as_str()) {
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

/// Lê o jar (janela de login ou a principal), guarda SAPISID e devolve o Cookie.
pub fn session_cookie(app: &AppHandle) -> Result<String, String> {
    if collect_cookies(app)? != "authorized" {
        return Err(
            "sessão do youtube recusada: recebido jar sem cookie de sessão, esperado login concluído"
                .to_string(),
        );
    }
    youtube_bind::bound_cookie_header(app)?.ok_or_else(|| {
        "sessão do youtube recusada: recebido jar sem cookie de sessão, esperado login concluído"
            .to_string()
    })
}

/// OurTube auth_check: authorized / pending / no_window. Fecha o login no authorized.
pub fn auth_check(app: &AppHandle) -> Result<String, String> {
    if app.get_webview_window(WINDOW_LABEL).is_none() {
        return Ok(if youtube_bind::load_auth(app)?.is_some() {
            "authorized".to_string()
        } else {
            "no_window".to_string()
        });
    }
    let status = collect_cookies(app)?;
    if status == "authorized" {
        if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
            let _ = window.close();
        }
        let _ = app.emit("youtube-session", true);
    }
    Ok(status)
}

/// Fecha a sessão no webview oficial e apaga o cookie do cofre.
pub fn sign_out(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(WINDOW_LABEL) {
        window.clear_all_browsing_data().map_err(|error| {
            format!("sessão do youtube recusada: recebido {error}, esperado limpar o webview")
        })?;
        let _ = window.close();
    }
    youtube_bind::clear_auth(app)
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
    fn capture_page_ok_aceita_google_e_youtube() {
        assert!(capture_page_ok("https://www.youtube.com/"));
        assert!(capture_page_ok("https://m.youtube.com/feed/subscriptions"));
        assert!(capture_page_ok("https://youtube.com/"));
        assert!(capture_page_ok(
            "https://accounts.google.com/ServiceLogin?service=youtube"
        ));
        assert!(!capture_page_ok("http://www.youtube.com/"));
        assert!(!capture_page_ok("https://example.net/"));
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
