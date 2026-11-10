use sha1::{Digest, Sha1};

pub const ORIGIN: &str = "https://www.youtube.com";
pub const COOKIE_ACCOUNT: &str = "youtube_cookie";
pub const ANDROID_USER_AGENT: &str =
    "com.google.android.youtube/20.10.4 (Linux; U; Android 11) gzip";
const WEB_USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";
const WEB_CLIENT_VERSION: &str = "2.20261105.05.01";
const ANDROID_CLIENT_VERSION: &str = "20.10.4";
const IOS_CLIENT_VERSION: &str = "20.10.4";
const IOS_DEVICE_MODEL: &str = "iPhone16,2";
const IOS_OS_VERSION: &str = "18.3.2.22D82";

const ALLOWED: [&str; 6] = [
    "/youtubei/v1/browse",
    "/youtubei/v1/search",
    "/youtubei/v1/player",
    "/youtubei/v1/next",
    "/youtubei/v1/guide",
    "/youtubei/v1/account/account_menu",
];

/// Só o Innertube de catálogo/player. log_event e WEB_REMIX ficam de fora.
pub fn allowed(method: &str, path: &str) -> bool {
    method == "POST" && ALLOWED.contains(&path)
}

/// `SAPISIDHASH <ts>_<sha1(ts + " " + sapisid + " " + https://www.youtube.com)>`.
pub fn sapisid_hash(sapisid: &str, timestamp: i64) -> String {
    let mut hasher = Sha1::new();
    hasher.update(format!("{timestamp} {sapisid} {ORIGIN}").as_bytes());
    format!("SAPISIDHASH {timestamp}_{:x}", hasher.finalize())
}

fn sapisid_from(cookie: &str) -> Option<String> {
    let mut fallback = None;
    for part in cookie.split(';') {
        let Some((name, value)) = part.trim().split_once('=') else {
            continue;
        };
        if name == "SAPISID" && !value.is_empty() {
            return Some(value.to_string());
        }
        if name == "__Secure-3PAPISID" && !value.is_empty() {
            fallback = Some(value.to_string());
        }
    }
    fallback
}

fn client_name(body: &str) -> String {
    let Ok(value) = serde_json::from_str::<serde_json::Value>(body) else {
        return "WEB".to_string();
    };
    value
        .pointer("/context/client/clientName")
        .and_then(|item| item.as_str())
        .unwrap_or("WEB")
        .to_string()
}

fn client_kind(name: &str) -> &'static str {
    if name == "ANDROID" {
        "android"
    } else if name == "IOS" {
        "ios"
    } else {
        "web"
    }
}

/// ANDROID usa o UA do app; WEB e IOS usam Chrome (OurTube, 05/11/2026).
pub fn innertube_user_agent(name: &str) -> &'static str {
    if name == "ANDROID" {
        ANDROID_USER_AGENT
    } else {
        WEB_USER_AGENT
    }
}

fn url_for(path: &str) -> String {
    format!("{ORIGIN}{path}?prettyPrint=false")
}

fn innertube_headers(cookie: Option<&str>, name: &str) -> Vec<(String, String)> {
    let kind = client_kind(name);
    let mut headers = vec![
        ("content-type".into(), "application/json".into()),
        ("accept-language".into(), "pt-BR,pt;q=0.9".into()),
        ("user-agent".into(), innertube_user_agent(name).into()),
    ];
    if kind == "web" {
        headers.push(("x-youtube-client-name".into(), "1".into()));
        headers.push(("x-youtube-client-version".into(), WEB_CLIENT_VERSION.into()));
        headers.push(("origin".into(), ORIGIN.into()));
        headers.push(("referer".into(), format!("{ORIGIN}/")));
    }
    let Some(cookie) = cookie.filter(|item| !item.is_empty()) else {
        return headers;
    };
    headers.push(("cookie".into(), cookie.to_string()));
    if kind != "web" {
        return headers;
    }
    if let Some(sapisid) = sapisid_from(cookie) {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|item| item.as_secs() as i64)
            .unwrap_or(0);
        headers.push(("authorization".into(), sapisid_hash(&sapisid, timestamp)));
        headers.push(("x-goog-authuser".into(), "0".into()));
    }
    headers
}

fn apply_async(
    mut builder: reqwest::RequestBuilder,
    headers: &[(String, String)],
) -> reqwest::RequestBuilder {
    for (name, value) in headers {
        builder = builder.header(name.as_str(), value);
    }
    builder
}

fn apply_blocking(
    mut builder: reqwest::blocking::RequestBuilder,
    headers: &[(String, String)],
) -> reqwest::blocking::RequestBuilder {
    for (name, value) in headers {
        builder = builder.header(name.as_str(), value);
    }
    builder
}

/// POST Innertube; WEB assina SAPISIDHASH, ANDROID/IOS só levam o cookie.
pub async fn request(
    app: &tauri::AppHandle,
    path: &str,
    body: Option<&str>,
) -> Result<String, String> {
    if !allowed("POST", path) {
        return Err(format!(
            "endpoint do youtube recusado: recebido POST {path}, esperado POST /youtubei/v1/browse, /youtubei/v1/search, /youtubei/v1/player, /youtubei/v1/next, /youtubei/v1/guide ou /youtubei/v1/account/account_menu"
        ));
    }
    let payload = body.unwrap_or("{}");
    let app_bind = app.clone();
    let cookie = tauri::async_runtime::spawn_blocking(move || {
        crate::youtube_bind::bound_cookie_header(&app_bind)
    })
    .await
    .map_err(|error| format!("youtube recusou: recebido {error}, esperado bind da sessão"))??;
    let headers = innertube_headers(cookie.as_deref(), &client_name(payload));
    let client = reqwest::Client::builder()
        .gzip(true)
        .build()
        .map_err(|error| format!("youtube recusou: recebido {error}, esperado cliente HTTP"))?;
    let response = apply_async(client.post(url_for(path)), &headers)
        .body(payload.to_string())
        .send()
        .await
        .map_err(|error| format!("youtube recusou: recebido {error}, esperado resposta HTTP"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("youtube recusou: recebido {error}, esperado corpo JSON"))?;
    if !status.is_success() {
        return Err(format!(
            "youtube recusou: recebido HTTP {status}, esperado 2xx"
        ));
    }
    Ok(text)
}

fn android_player_body(video_id: &str) -> String {
    serde_json::json!({
        "context": {
            "client": {
                "clientName": "ANDROID",
                "clientVersion": ANDROID_CLIENT_VERSION,
                "androidSdkVersion": 30,
                "osName": "Android",
                "osVersion": "11",
                "hl": "pt",
                "gl": "BR"
            }
        },
        "contentCheckOk": true,
        "racyCheckOk": true,
        "videoId": video_id
    })
    .to_string()
}

fn ios_player_body(video_id: &str) -> String {
    serde_json::json!({
        "context": {
            "client": {
                "clientName": "IOS",
                "clientVersion": IOS_CLIENT_VERSION,
                "deviceModel": IOS_DEVICE_MODEL,
                "osName": "iPhone",
                "osVersion": IOS_OS_VERSION,
                "hl": "pt",
                "gl": "BR"
            }
        },
        "contentCheckOk": true,
        "racyCheckOk": true,
        "videoId": video_id
    })
    .to_string()
}

fn web_player_body(video_id: &str) -> String {
    serde_json::json!({
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": WEB_CLIENT_VERSION,
                "hl": "pt",
                "gl": "BR"
            }
        },
        "contentCheckOk": true,
        "racyCheckOk": true,
        "videoId": video_id
    })
    .to_string()
}

fn playable_ok(payload: &serde_json::Value) -> bool {
    payload
        .pointer("/playabilityStatus/status")
        .and_then(|item| item.as_str())
        .unwrap_or("OK")
        == "OK"
}

fn muxed_url(payload: &serde_json::Value) -> Option<String> {
    if !playable_ok(payload) {
        return None;
    }
    let formats = payload
        .pointer("/streamingData/formats")
        .and_then(|item| item.as_array())?;
    for format in formats {
        let mime = format
            .get("mimeType")
            .and_then(|item| item.as_str())
            .unwrap_or("");
        let url = format
            .get("url")
            .and_then(|item| item.as_str())
            .unwrap_or("");
        if mime.starts_with("video/mp4") && !url.is_empty() {
            return Some(url.to_string());
        }
    }
    None
}

fn hls_manifest_url(payload: &serde_json::Value) -> Option<String> {
    if !playable_ok(payload) {
        return None;
    }
    let url = payload
        .pointer("/streamingData/hlsManifestUrl")
        .and_then(|item| item.as_str())?;
    if url.starts_with("https://") && url.contains("googlevideo.com") && url.contains(".m3u8") {
        Some(url.to_string())
    } else {
        None
    }
}

fn choose_player_payload(
    attempts: impl IntoIterator<Item = Result<serde_json::Value, String>>,
) -> Result<serde_json::Value, String> {
    let mut last = Err(
        "player do youtube recusado: recebido nenhum /player, esperado ANDROID, IOS ou WEB".into(),
    );
    for attempt in attempts {
        match attempt {
            Ok(payload) if playable_ok(&payload) => return Ok(payload),
            other => last = other,
        }
    }
    last
}

fn fetch_player_payload(
    cookie: Option<&str>,
    name: &str,
    body: String,
) -> Result<serde_json::Value, String> {
    let client = reqwest::blocking::Client::builder()
        .gzip(true)
        .timeout(std::time::Duration::from_secs(25))
        .build()
        .map_err(|error| format!("youtube recusou: recebido {error}, esperado cliente HTTP"))?;
    let headers = innertube_headers(cookie, name);
    let response = apply_blocking(client.post(url_for("/youtubei/v1/player")), &headers)
        .body(body)
        .send()
        .map_err(|error| format!("youtube recusou: recebido {error}, esperado /player"))?;
    let status = response.status();
    let payload: serde_json::Value = response
        .json()
        .map_err(|error| format!("youtube recusou: recebido {error}, esperado JSON do /player"))?;
    if !status.is_success() {
        return Err(format!(
            "youtube recusou: recebido HTTP {status}, esperado 2xx no /player"
        ));
    }
    Ok(payload)
}

fn player_payload(cookie: Option<&str>, video_id: &str) -> Result<serde_json::Value, String> {
    let android = fetch_player_payload(cookie, "ANDROID", android_player_body(video_id));
    if let Ok(payload) = &android {
        if playable_ok(payload) {
            return android;
        }
    }
    let ios = fetch_player_payload(cookie, "IOS", ios_player_body(video_id));
    if let Ok(payload) = &ios {
        if playable_ok(payload) {
            return ios;
        }
    }
    let web = fetch_player_payload(cookie, "WEB", web_player_body(video_id));
    choose_player_payload([android, ios, web])
}

/// Resolve a URL googlevideo do itag 18 (chamada bloqueante do proxy).
pub fn resolve_progressive_url(cookie: Option<&str>, video_id: &str) -> Result<String, String> {
    muxed_url(&player_payload(cookie, video_id)?).ok_or_else(|| {
        format!("player do youtube recusado: recebido nenhum mp4 com url, esperado itag 18 para {video_id}")
    })
}

#[cfg(test)]
fn first_hls_url<'a>(payloads: impl IntoIterator<Item = &'a serde_json::Value>) -> Option<String> {
    payloads.into_iter().find_map(hls_manifest_url)
}

/// Resolve `hlsManifestUrl` (ANDROID, depois IOS/WEB — VOD ANDROID só tem itag 18).
pub fn resolve_hls_url(cookie: Option<&str>, video_id: &str) -> Result<String, String> {
    let err = format!(
        "player do youtube recusado: recebido nenhum mp4 com url, esperado itag 18 ou hlsManifestUrl para {video_id}"
    );
    for (name, body) in [
        ("ANDROID", android_player_body(video_id)),
        ("IOS", ios_player_body(video_id)),
        ("WEB", web_player_body(video_id)),
    ] {
        if let Ok(payload) = fetch_player_payload(cookie, name, body) {
            if let Some(url) = hls_manifest_url(&payload) {
                return Ok(url);
            }
        }
    }
    Err(err)
}

#[cfg(test)]
mod tests {
    use super::{
        allowed, choose_player_payload, first_hls_url, hls_manifest_url, innertube_user_agent,
        muxed_url, playable_ok, sapisid_from, sapisid_hash, ANDROID_USER_AGENT,
    };

    #[test]
    fn allowlist_so_innertube_post() {
        assert!(allowed("POST", "/youtubei/v1/browse"));
        assert!(allowed("POST", "/youtubei/v1/player"));
        assert!(allowed("POST", "/youtubei/v1/account/account_menu"));
        assert!(!allowed("GET", "/youtubei/v1/browse"));
        assert!(!allowed("POST", "/youtubei/v1/log_event"));
        assert!(!allowed(
            "POST",
            "/youtubei/v1/music/get_search_suggestions"
        ));
    }

    #[test]
    fn ios_usa_ua_chrome_android_usa_app() {
        assert_eq!(innertube_user_agent("ANDROID"), ANDROID_USER_AGENT);
        assert!(innertube_user_agent("IOS").starts_with("Mozilla/5.0"));
        assert!(!innertube_user_agent("IOS").contains("android.youtube"));
    }

    #[test]
    fn choose_player_payload_cai_no_ios_quando_android_pede_login() {
        let android = Ok(serde_json::json!({
            "playabilityStatus": {
                "status": "LOGIN_REQUIRED",
                "reason": "Faça login para confirmar que você não é um bot"
            }
        }));
        let ios = Ok(serde_json::json!({
            "playabilityStatus": { "status": "OK" },
            "streamingData": {
                "hlsManifestUrl": "https://manifest.googlevideo.com/api/manifest/hls_variant/x/file/index.m3u8"
            }
        }));
        let chosen = choose_player_payload([android, ios]).unwrap();
        assert!(playable_ok(&chosen));
        assert!(hls_manifest_url(&chosen)
            .unwrap()
            .contains("manifest.googlevideo.com"));
    }

    #[test]
    fn choose_player_payload_cai_no_web_quando_android_e_ios_pedem_login() {
        let android = Ok(serde_json::json!({
            "playabilityStatus": {
                "status": "LOGIN_REQUIRED",
                "reason": "Faça login para confirmar que você não é um bot"
            }
        }));
        let ios = Ok(serde_json::json!({
            "playabilityStatus": {
                "status": "LOGIN_REQUIRED",
                "reason": "Faça login para confirmar que você não é um bot"
            }
        }));
        let web = Ok(serde_json::json!({
            "playabilityStatus": { "status": "OK" },
            "streamingData": {
                "formats": [{
                    "itag": 18,
                    "mimeType": "video/mp4; codecs=\"avc1\"",
                    "url": "https://rr1---sn.googlevideo.com/videoplayback?id=x&itag=18"
                }]
            }
        }));
        let chosen = choose_player_payload([android, ios, web]).unwrap();
        assert!(playable_ok(&chosen));
        assert!(muxed_url(&chosen).unwrap().contains("googlevideo.com"));
    }

    #[test]
    fn sapisid_hash_tem_prefixo_e_sha1() {
        let header = sapisid_hash("secret", 1_700_000_000);
        assert!(header.starts_with("SAPISIDHASH 1700000000_"));
        assert_eq!(header.len(), "SAPISIDHASH 1700000000_".len() + 40);
        assert!(!header.contains("music.youtube.com"));
    }

    #[test]
    fn sapisid_prefere_sapisid_e_cai_no_secure() {
        assert_eq!(
            sapisid_from("SID=x; SAPISID=abc; __Secure-3PAPISID=zzz"),
            Some("abc".into())
        );
        assert_eq!(
            sapisid_from("__Secure-3PAPISID=zzz; SID=x"),
            Some("zzz".into())
        );
    }

    #[test]
    fn muxed_url_pega_itag_18_e_ignora_cipher() {
        let payload = serde_json::json!({
            "playabilityStatus": { "status": "OK" },
            "streamingData": {
                "formats": [
                    { "itag": 22, "mimeType": "video/mp4", "url": "" },
                    { "itag": 18, "mimeType": "video/mp4; codecs=\"avc1\"", "url": "https://rr1---sn.googlevideo.com/videoplayback?id=x" }
                ]
            }
        });
        assert!(muxed_url(&payload).unwrap().contains("googlevideo.com"));
        let blocked = serde_json::json!({
            "playabilityStatus": { "status": "LOGIN_REQUIRED", "reason": "Sign in" },
            "streamingData": { "formats": [] }
        });
        assert_eq!(muxed_url(&blocked), None);
    }

    #[test]
    fn first_hls_url_prefere_ios_quando_android_so_tem_itag_18() {
        let android = serde_json::json!({
            "playabilityStatus": { "status": "OK" },
            "streamingData": {
                "formats": [{
                    "itag": 18,
                    "mimeType": "video/mp4",
                    "url": "https://rr1---sn.googlevideo.com/videoplayback?id=x&itag=18"
                }]
            }
        });
        let ios = serde_json::json!({
            "playabilityStatus": { "status": "OK" },
            "streamingData": {
                "hlsManifestUrl": "https://manifest.googlevideo.com/api/manifest/hls_variant/x/file/index.m3u8"
            }
        });
        assert_eq!(first_hls_url([&android]), None);
        assert!(first_hls_url([&android, &ios])
            .unwrap()
            .contains("manifest.googlevideo.com"));
    }

    #[test]
    fn hls_manifest_url_pega_live_sem_mp4() {
        let payload = serde_json::json!({
            "playabilityStatus": { "status": "OK" },
            "streamingData": {
                "formats": [],
                "hlsManifestUrl": "https://manifest.googlevideo.com/api/manifest/hls_variant/x/file/index.m3u8"
            }
        });
        assert!(hls_manifest_url(&payload)
            .unwrap()
            .contains("manifest.googlevideo.com"));
        let blocked = serde_json::json!({
            "playabilityStatus": { "status": "LOGIN_REQUIRED" },
            "streamingData": {
                "hlsManifestUrl": "https://manifest.googlevideo.com/x.m3u8"
            }
        });
        assert_eq!(hls_manifest_url(&blocked), None);
        let http = serde_json::json!({
            "playabilityStatus": { "status": "OK" },
            "streamingData": { "hlsManifestUrl": "http://manifest.googlevideo.com/x.m3u8" }
        });
        assert_eq!(hls_manifest_url(&http), None);
    }
}
