//! Bind da sessão Google → YouTube (OurTube CookieAuth, origem www.youtube.com).
//! `__Host-*` não vai pro Innertube; ListAccounts/SetSID precisa deles no handshake.

use std::collections::HashMap;
use std::time::Duration;

use crate::secrets;
use crate::youtube_api::COOKIE_ACCOUNT;

pub const IDENTITY_ACCOUNT: &str = "youtube_identity";
pub const ORIGIN: &str = "https://www.youtube.com";
pub const YOUTUBE_CONTINUE_URL: &str =
    "https://accounts.google.com/ServiceLogin?service=youtube&continue=https%3A%2F%2Fwww.youtube.com%2F";

const HANDSHAKE_USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

pub const AUTH_COOKIE_NAMES: [&str; 20] = [
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

pub const IDENTITY_COOKIE_NAMES: [&str; 5] = [
    "ACCOUNT_CHOOSER",
    "LSID",
    "__Host-GAPS",
    "__Host-1PLSID",
    "__Host-3PLSID",
];

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct CookieAuth {
    pub cookies: String,
    pub sapisid: String,
    pub identity_cookies: String,
}

pub fn cookie_header(pairs: &[(String, String)]) -> String {
    let mut seen: Vec<&str> = Vec::new();
    let mut header = Vec::new();
    for (name, value) in pairs {
        if !AUTH_COOKIE_NAMES.contains(&name.as_str()) || seen.contains(&name.as_str()) {
            continue;
        }
        seen.push(name);
        header.push(format!("{name}={value}"));
    }
    header.join("; ")
}

pub fn identity_cookie_header(pairs: &[(String, String)]) -> String {
    let mut header = Vec::new();
    for name in IDENTITY_COOKIE_NAMES {
        if let Some((_, value)) = pairs.iter().find(|(cookie_name, _)| cookie_name == name) {
            if !value.is_empty() {
                header.push(format!("{name}={value}"));
            }
        }
    }
    header.join("; ")
}

pub fn parse_cookie_header(header: &str) -> Vec<(String, String)> {
    header
        .split(';')
        .filter_map(|part| {
            let part = part.trim();
            let (name, value) = part.split_once('=')?;
            if name.is_empty() {
                return None;
            }
            Some((name.to_string(), value.to_string()))
        })
        .collect()
}

pub fn youtube_session_bound(pairs: &[(String, String)]) -> bool {
    pairs.iter().any(|(name, value)| {
        (name == "LOGIN_INFO" || name == "VISITOR_INFO1_LIVE") && !value.is_empty()
    })
}

pub fn session_is_youtube_bound(auth: &CookieAuth) -> bool {
    youtube_session_bound(&parse_cookie_header(&auth.cookies))
}

pub fn handshake_cookie_header(auth: &CookieAuth) -> String {
    [auth.identity_cookies.as_str(), auth.cookies.as_str()]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>()
        .join("; ")
}

fn set_cookies_include_login_info(set_cookies: &[String]) -> bool {
    set_cookies.iter().any(|line| {
        parse_set_cookie(line).is_some_and(|(name, value, expired)| {
            name == "LOGIN_INFO" && !value.is_empty() && !expired
        })
    })
}

pub fn apply_login_info_cookies(auth: &CookieAuth, set_cookies: &[String]) -> CookieAuth {
    if !set_cookies_include_login_info(set_cookies) {
        return auth.clone();
    }
    apply_set_cookies(auth, set_cookies)
}

pub fn apply_set_cookies(auth: &CookieAuth, set_cookies: &[String]) -> CookieAuth {
    let mut innertube = map_from_pairs(&parse_cookie_header(&auth.cookies));
    let mut identity = map_from_pairs(&parse_cookie_header(&auth.identity_cookies));
    for line in set_cookies {
        let Some((name, value, expired)) = parse_set_cookie(line) else {
            continue;
        };
        let target = if IDENTITY_COOKIE_NAMES.contains(&name.as_str()) {
            &mut identity
        } else if AUTH_COOKIE_NAMES.contains(&name.as_str()) {
            &mut innertube
        } else {
            continue;
        };
        if expired || value.is_empty() {
            target.remove(&name);
        } else {
            target.insert(name, value);
        }
    }
    let innertube_pairs = pairs_from_map(&innertube);
    let sapisid = innertube_pairs
        .iter()
        .find(|(name, _)| name == "SAPISID")
        .or_else(|| {
            innertube_pairs
                .iter()
                .find(|(name, _)| name == "__Secure-3PAPISID")
        })
        .map(|(_, value)| value.clone())
        .unwrap_or_else(|| auth.sapisid.clone());
    CookieAuth {
        cookies: cookie_header(&innertube_pairs),
        sapisid,
        identity_cookies: identity_cookie_header(&pairs_from_map(&identity)),
    }
}

fn map_from_pairs(pairs: &[(String, String)]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for (name, value) in pairs {
        map.entry(name.clone()).or_insert_with(|| value.clone());
    }
    map
}

fn pairs_from_map(map: &HashMap<String, String>) -> Vec<(String, String)> {
    map.iter()
        .map(|(name, value)| (name.clone(), value.clone()))
        .collect()
}

fn parse_set_cookie(line: &str) -> Option<(String, String, bool)> {
    let mut attrs = line.split(';').map(str::trim);
    let first = attrs.next()?;
    let (name, value) = first.split_once('=')?;
    if name.is_empty() {
        return None;
    }
    let mut expired = value.is_empty();
    for attr in attrs {
        let (key, attr_value) = attr.split_once('=').unwrap_or((attr, ""));
        if key.eq_ignore_ascii_case("max-age") {
            if attr_value.parse::<i64>().ok().is_some_and(|age| age <= 0) {
                expired = true;
            }
        }
    }
    Some((name.to_string(), value.to_string(), expired))
}

fn response_set_cookies(response: &reqwest::blocking::Response) -> Vec<String> {
    response
        .headers()
        .get_all("set-cookie")
        .iter()
        .map(|value| String::from_utf8_lossy(value.as_bytes()).into_owned())
        .collect()
}

fn mint_login_info(
    http: &reqwest::blocking::Client,
    auth: &CookieAuth,
) -> Result<CookieAuth, String> {
    let response = http
        .get(ORIGIN)
        .header("cookie", handshake_cookie_header(auth))
        .header("user-agent", HANDSHAKE_USER_AGENT)
        .header("accept", "text/html")
        .send()
        .map_err(|error| format!("youtube LOGIN_INFO mint failed: {error}"))?;
    Ok(apply_login_info_cookies(
        auth,
        &response_set_cookies(&response),
    ))
}

fn youtube_host(url: &str) -> bool {
    reqwest::Url::parse(url)
        .ok()
        .and_then(|parsed| parsed.host_str().map(str::to_string))
        .is_some_and(|host| host == "www.youtube.com" || host == "youtube.com")
}

/// ServiceLogin continue=www.youtube.com para o Innertube ver LOGIN_INFO.
pub fn bind_youtube_session(auth: &CookieAuth) -> Result<CookieAuth, String> {
    if session_is_youtube_bound(auth) {
        return Ok(auth.clone());
    }
    let http = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(25))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|error| format!("youtube SetSID client: {error}"))?;
    let minted = mint_login_info(&http, auth)?;
    if session_is_youtube_bound(&minted) {
        return Ok(minted);
    }
    let mut url = YOUTUBE_CONTINUE_URL.to_string();
    let mut current = minted;
    for _ in 0..8 {
        let response = http
            .get(&url)
            .header("cookie", handshake_cookie_header(&current))
            .header("user-agent", HANDSHAKE_USER_AGENT)
            .header("accept", "text/html")
            .send()
            .map_err(|error| format!("youtube SetSID failed: {error}"))?;
        let set_cookies = response_set_cookies(&response);
        current = apply_set_cookies(&current, &set_cookies);
        let status = response.status();
        if status.is_redirection() {
            let location = response
                .headers()
                .get("location")
                .and_then(|value| value.to_str().ok())
                .ok_or_else(|| {
                    format!("youtube SetSID HTTP {} missing Location", status.as_u16())
                })?;
            url = resolve_location(&url, location)?;
            if youtube_host(&url) {
                return mint_login_info(&http, &current);
            }
            continue;
        }
        if !status.is_success() {
            return Err(format!("youtube SetSID returned HTTP {}", status.as_u16()));
        }
        break;
    }
    mint_login_info(&http, &current)
}

fn resolve_location(current: &str, location: &str) -> Result<String, String> {
    let base = reqwest::Url::parse(current)
        .map_err(|error| format!("youtube SetSID url {current}: {error}"))?;
    base.join(location)
        .map(|url| url.to_string())
        .map_err(|error| format!("youtube SetSID location {location}: {error}"))
}

pub fn extract_cookie_auth(pairs: &[(String, String)]) -> Option<CookieAuth> {
    let sapisid = pairs
        .iter()
        .find(|(name, _)| name == "SAPISID")
        .or_else(|| pairs.iter().find(|(name, _)| name == "__Secure-3PAPISID"))
        .map(|(_, value)| value.clone())?;
    if sapisid.is_empty() {
        return None;
    }
    Some(CookieAuth {
        cookies: cookie_header(pairs),
        sapisid,
        identity_cookies: identity_cookie_header(pairs),
    })
}

pub fn store_auth(app: &tauri::AppHandle, auth: &CookieAuth) -> Result<(), String> {
    secrets::set(app, COOKIE_ACCOUNT, &auth.cookies)?;
    secrets::set(app, IDENTITY_ACCOUNT, &auth.identity_cookies)
}

pub fn clear_auth(app: &tauri::AppHandle) -> Result<(), String> {
    secrets::remove(app, COOKIE_ACCOUNT)?;
    secrets::remove(app, IDENTITY_ACCOUNT)
}

pub fn load_auth(app: &tauri::AppHandle) -> Result<Option<CookieAuth>, String> {
    let cookies = secrets::get(app, COOKIE_ACCOUNT)?.unwrap_or_default();
    if cookies.is_empty() {
        return Ok(None);
    }
    let identity = secrets::get(app, IDENTITY_ACCOUNT)?.unwrap_or_default();
    let pairs = parse_cookie_header(&cookies);
    let mut auth = extract_cookie_auth(&pairs).unwrap_or(CookieAuth {
        cookies: cookies.clone(),
        sapisid: String::new(),
        identity_cookies: identity.clone(),
    });
    if auth.identity_cookies.is_empty() {
        auth.identity_cookies = identity;
    }
    Ok(Some(auth))
}

/// Innertube Cookie já com LOGIN_INFO quando o handshake conseguir.
pub fn bound_cookie_header(app: &tauri::AppHandle) -> Result<Option<String>, String> {
    let Some(auth) = load_auth(app)? else {
        return Ok(None);
    };
    if session_is_youtube_bound(&auth) {
        return Ok(Some(auth.cookies));
    }
    match bind_youtube_session(&auth) {
        Ok(bound) => {
            store_auth(app, &bound)?;
            Ok(Some(bound.cookies))
        }
        Err(_) => Ok(Some(auth.cookies)),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        apply_login_info_cookies, apply_set_cookies, cookie_header, extract_cookie_auth,
        handshake_cookie_header, identity_cookie_header, parse_cookie_header,
        youtube_session_bound, CookieAuth, YOUTUBE_CONTINUE_URL,
    };

    #[test]
    fn cookie_header_drops_host_cookies() {
        let pairs = vec![
            ("SAPISID".to_string(), "abc".to_string()),
            ("__Host-GAPS".to_string(), "junk".to_string()),
            ("SID".to_string(), "def".to_string()),
            ("LOGIN_INFO".to_string(), "login".to_string()),
        ];
        let header = cookie_header(&pairs);
        assert_eq!(header, "SAPISID=abc; SID=def; LOGIN_INFO=login");
        assert!(!header.contains("__Host-GAPS"));
    }

    #[test]
    fn identity_cookie_header_keeps_google_account_cookies() {
        let pairs = vec![
            ("SAPISID".to_string(), "abc".to_string()),
            ("__Host-GAPS".to_string(), "gaps".to_string()),
            ("ACCOUNT_CHOOSER".to_string(), "chooser".to_string()),
            ("LSID".to_string(), "lsid".to_string()),
        ];
        let header = identity_cookie_header(&pairs);
        assert_eq!(
            header,
            "ACCOUNT_CHOOSER=chooser; LSID=lsid; __Host-GAPS=gaps"
        );
        assert!(!header.contains("SAPISID"));
    }

    #[test]
    fn youtube_session_bound_needs_login_info_or_visitor() {
        assert!(!youtube_session_bound(&[
            ("SAPISID".to_string(), "abc".to_string()),
            ("SID".to_string(), "def".to_string()),
        ]));
        assert!(youtube_session_bound(&[(
            "LOGIN_INFO".to_string(),
            "login".to_string()
        )]));
    }

    #[test]
    fn extract_cookie_auth_prefers_sapisid() {
        let pairs = vec![
            ("__Secure-3PAPISID".to_string(), "secure".to_string()),
            ("SAPISID".to_string(), "plain".to_string()),
            ("__Host-GAPS".to_string(), "gaps".to_string()),
        ];
        let auth = extract_cookie_auth(&pairs).expect("signed in");
        assert_eq!(auth.sapisid, "plain");
        assert!(auth.cookies.contains("SAPISID=plain"));
        assert!(auth.identity_cookies.contains("__Host-GAPS=gaps"));
    }

    #[test]
    fn apply_set_cookies_adds_login_info() {
        let next = apply_set_cookies(
            &CookieAuth {
                cookies: "SAPISID=stale; SID=def".into(),
                sapisid: "stale".into(),
                identity_cookies: "ACCOUNT_CHOOSER=chooser".into(),
            },
            &[
                "SAPISID=fresh; Domain=.youtube.com; Secure".into(),
                "LOGIN_INFO=login; Domain=.youtube.com; Secure; HttpOnly".into(),
            ],
        );
        assert_eq!(next.sapisid, "fresh");
        assert!(next.cookies.contains("LOGIN_INFO=login"));
        assert_eq!(next.identity_cookies, "ACCOUNT_CHOOSER=chooser");
    }

    #[test]
    fn anonymous_html_without_login_info_is_ignored() {
        let auth = CookieAuth {
            cookies: "SAPISID=keep; SID=google".into(),
            sapisid: "keep".into(),
            identity_cookies: "LSID=lsid".into(),
        };
        let next =
            apply_login_info_cookies(&auth, &["SID=; Max-Age=0; Domain=.youtube.com".into()]);
        assert_eq!(next.cookies, auth.cookies);
    }

    #[test]
    fn continue_url_is_www_youtube_not_music() {
        assert!(YOUTUBE_CONTINUE_URL.contains("www.youtube.com"));
        assert!(!YOUTUBE_CONTINUE_URL.contains("music.youtube.com"));
    }

    #[test]
    fn handshake_sends_identity_with_google_sid() {
        let header = handshake_cookie_header(&CookieAuth {
            cookies: "SAPISID=abc; SID=def".into(),
            sapisid: "abc".into(),
            identity_cookies: "ACCOUNT_CHOOSER=chooser; LSID=lsid".into(),
        });
        assert!(header.contains("ACCOUNT_CHOOSER=chooser"));
        assert!(header.contains("LSID=lsid"));
        assert!(header.contains("SAPISID=abc"));
    }

    #[test]
    fn parse_cookie_header_keeps_values() {
        let pairs = parse_cookie_header("SAPISID=abc; LOGIN_INFO=login");
        assert_eq!(pairs[0], ("SAPISID".into(), "abc".into()));
        assert_eq!(pairs[1], ("LOGIN_INFO".into(), "login".into()));
    }
}
