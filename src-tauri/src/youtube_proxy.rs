use std::collections::HashMap;
use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

use tauri::AppHandle;

use crate::secrets;
use crate::youtube_api::{self, ANDROID_USER_AGENT, COOKIE_ACCOUNT};
use crate::youtube_media::{
    allowed_media_url, is_hls_playlist_url, parse_video_request, parse_ytg, range_header,
    rewrite_hls_playlist,
};

const CACHE_TTL: Duration = Duration::from_secs(600);
static PROXY_BASE: OnceLock<String> = OnceLock::new();

struct CachedUrl {
    url: String,
    stored_at: Instant,
}

/// Base `http://127.0.0.1:{port}` depois do `start`.
pub fn base_url() -> Result<String, String> {
    PROXY_BASE.get().cloned().ok_or_else(|| {
        "youtube recusou: recebido proxy parado, esperado youtube_proxy_base depois do boot"
            .to_string()
    })
}

/// Sobe o proxy de Range/HLS em 127.0.0.1:0.
pub fn start(app: AppHandle) -> Result<String, String> {
    if let Some(base) = PROXY_BASE.get() {
        return Ok(base.clone());
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| {
        format!("youtube recusou: recebido {error}, esperado bind em 127.0.0.1")
    })?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("youtube recusou: recebido {error}, esperado porta local"))?
        .port();
    let base = format!("http://127.0.0.1:{port}");
    let _ = PROXY_BASE.set(base.clone());
    let cache: Arc<Mutex<HashMap<String, CachedUrl>>> = Arc::new(Mutex::new(HashMap::new()));
    thread::spawn(move || {
        for connection in listener.incoming().flatten() {
            let app = app.clone();
            let cache = Arc::clone(&cache);
            thread::spawn(move || {
                let _ = serve(connection, app, cache);
            });
        }
    });
    Ok(base)
}

fn read_head(stream: &mut TcpStream) -> io::Result<String> {
    let mut buf = [0_u8; 8192];
    let mut got = Vec::new();
    loop {
        let n = stream.read(&mut buf)?;
        if n == 0 {
            break;
        }
        got.extend_from_slice(&buf[..n]);
        if got.windows(4).any(|window| window == b"\r\n\r\n") {
            break;
        }
        if got.len() >= 8192 {
            break;
        }
    }
    Ok(String::from_utf8_lossy(&got).into_owned())
}

fn write_plain(stream: &mut TcpStream, status: u16, body: &str) -> io::Result<()> {
    let reason = match status {
        404 => "Not Found",
        502 => "Bad Gateway",
        403 => "Forbidden",
        _ => "Error",
    };
    let head = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    stream.write_all(head.as_bytes())
}

fn write_preflight(stream: &mut TcpStream) -> io::Result<()> {
    stream.write_all(
        b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: range, content-type\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Max-Age: 86400\r\nConnection: close\r\n\r\n",
    )
}

fn write_playlist(stream: &mut TcpStream, body: &str) -> io::Result<()> {
    let head = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: application/vnd.apple.mpegurl\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes())?;
    stream.write_all(body.as_bytes())
}

fn cache_key(video_id: &str, kind: &str) -> String {
    format!("{video_id}:{kind}")
}

fn lookup(cache: &Mutex<HashMap<String, CachedUrl>>, key: &str) -> Option<String> {
    let map = cache.lock().ok()?;
    let entry = map.get(key)?;
    if entry.stored_at.elapsed() > CACHE_TTL {
        return None;
    }
    Some(entry.url.clone())
}

fn store(cache: &Mutex<HashMap<String, CachedUrl>>, key: &str, url: String) {
    if let Ok(mut map) = cache.lock() {
        map.insert(
            key.to_string(),
            CachedUrl {
                url,
                stored_at: Instant::now(),
            },
        );
    }
}

fn forget(cache: &Mutex<HashMap<String, CachedUrl>>, key: &str) {
    if let Ok(mut map) = cache.lock() {
        map.remove(key);
    }
}

fn media_url(
    app: &AppHandle,
    cache: &Mutex<HashMap<String, CachedUrl>>,
    video_id: &str,
    kind: &str,
    force: bool,
) -> Result<String, String> {
    let key = cache_key(video_id, kind);
    if !force {
        if let Some(url) = lookup(cache, &key) {
            return Ok(url);
        }
    }
    let cookie = secrets::get(app, COOKIE_ACCOUNT)?;
    let url = if kind == "m3u8" {
        youtube_api::resolve_hls_url(cookie.as_deref(), video_id)?
    } else {
        youtube_api::resolve_progressive_url(cookie.as_deref(), video_id)?
    };
    if !allowed_media_url(&url) {
        return Err(format!(
            "url do youtube recusada: recebido {url}, esperado https://*.googlevideo.com"
        ));
    }
    store(cache, &key, url.clone());
    Ok(url)
}

fn http_client() -> Result<reqwest::blocking::Client, String> {
    reqwest::blocking::Client::builder()
        .gzip(true)
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| format!("{error}"))
}

fn fetch_and_rewrite(url: &str) -> Result<String, String> {
    let response = http_client()?
        .get(url)
        .header("user-agent", ANDROID_USER_AGENT)
        .header("accept", "*/*")
        .send()
        .map_err(|error| format!("{error}"))?;
    let status = response.status().as_u16();
    if status == 403 {
        return Err("403".into());
    }
    if status != 200 {
        return Err(format!("HTTP {status}"));
    }
    let body = response.text().map_err(|error| format!("{error}"))?;
    if !body.trim_start().starts_with("#EXTM3U") {
        return Err("playlist recusada: esperado #EXTM3U".into());
    }
    Ok(rewrite_hls_playlist(&body, &base_url()?))
}

fn pipe(
    stream: &mut TcpStream,
    media: &str,
    range: Option<&str>,
    force_range: bool,
) -> Result<u16, String> {
    let mut builder = http_client()?
        .get(media)
        .header("user-agent", ANDROID_USER_AGENT)
        .header("accept", "*/*");
    let range = range.map(str::trim).filter(|item| !item.is_empty());
    if let Some(value) = range {
        builder = builder.header("range", value);
    } else if force_range {
        builder = builder.header("range", "bytes=0-");
    }
    let mut response = builder.send().map_err(|error| format!("{error}"))?;
    let status = response.status().as_u16();
    if status == 403 {
        return Ok(403);
    }
    if status != 200 && status != 206 {
        return Err(format!("HTTP {status}"));
    }
    let mime = response
        .headers()
        .get("content-type")
        .and_then(|item| item.to_str().ok())
        .unwrap_or("video/mp4")
        .to_string();
    let content_range = response
        .headers()
        .get("content-range")
        .and_then(|item| item.to_str().ok())
        .map(str::to_string);
    let content_length = response
        .headers()
        .get("content-length")
        .and_then(|item| item.to_str().ok())
        .map(str::to_string);
    let reason = if status == 206 {
        "Partial Content"
    } else {
        "OK"
    };
    let mut head = format!("HTTP/1.1 {status} {reason}\r\n");
    head.push_str(&format!("Content-Type: {mime}\r\n"));
    head.push_str("Accept-Ranges: bytes\r\n");
    head.push_str("Access-Control-Allow-Origin: *\r\n");
    head.push_str("Access-Control-Expose-Headers: content-range, content-length, content-type\r\n");
    head.push_str("Cache-Control: no-store\r\n");
    if let Some(value) = content_range {
        head.push_str(&format!("Content-Range: {value}\r\n"));
    }
    if let Some(value) = content_length {
        head.push_str(&format!("Content-Length: {value}\r\n"));
    }
    head.push_str("Connection: close\r\n\r\n");
    stream
        .write_all(head.as_bytes())
        .map_err(|error| format!("{error}"))?;
    let _ = io::copy(&mut response, stream);
    Ok(status)
}

fn serve_mp4(
    stream: &mut TcpStream,
    app: &AppHandle,
    cache: &Mutex<HashMap<String, CachedUrl>>,
    video_id: &str,
    range: Option<&str>,
) -> io::Result<()> {
    let url = match media_url(app, cache, video_id, "mp4", false) {
        Ok(url) => url,
        Err(error) => return write_plain(stream, 502, &error),
    };
    match pipe(stream, &url, range, true) {
        Ok(403) => {
            forget(cache, &cache_key(video_id, "mp4"));
            let fresh = match media_url(app, cache, video_id, "mp4", true) {
                Ok(url) => url,
                Err(error) => return write_plain(stream, 502, &error),
            };
            match pipe(stream, &fresh, range, true) {
                Ok(403) => write_plain(stream, 403, "expired"),
                Ok(_) => Ok(()),
                Err(error) => write_plain(stream, 502, &error),
            }
        }
        Ok(_) => Ok(()),
        Err(error) => write_plain(stream, 502, &error),
    }
}

fn serve_master(
    stream: &mut TcpStream,
    app: &AppHandle,
    cache: &Mutex<HashMap<String, CachedUrl>>,
    video_id: &str,
) -> io::Result<()> {
    let url = match media_url(app, cache, video_id, "m3u8", false) {
        Ok(url) => url,
        Err(error) => return write_plain(stream, 502, &error),
    };
    match fetch_and_rewrite(&url) {
        Ok(body) => write_playlist(stream, &body),
        Err(error) if error == "403" => {
            forget(cache, &cache_key(video_id, "m3u8"));
            let fresh = match media_url(app, cache, video_id, "m3u8", true) {
                Ok(url) => url,
                Err(error) => return write_plain(stream, 502, &error),
            };
            match fetch_and_rewrite(&fresh) {
                Ok(body) => write_playlist(stream, &body),
                Err(_) => write_plain(stream, 403, "expired"),
            }
        }
        Err(error) => write_plain(stream, 502, &error),
    }
}

fn serve_ytg(stream: &mut TcpStream, media: &str, range: Option<&str>) -> io::Result<()> {
    if is_hls_playlist_url(media) {
        return match fetch_and_rewrite(media) {
            Ok(body) => write_playlist(stream, &body),
            Err(error) if error == "403" => write_plain(stream, 403, "expired"),
            Err(error) => write_plain(stream, 502, &error),
        };
    }
    match pipe(stream, media, range, false) {
        Ok(403) => write_plain(stream, 403, "expired"),
        Ok(_) => Ok(()),
        Err(error) => write_plain(stream, 502, &error),
    }
}

fn serve(
    mut stream: TcpStream,
    app: AppHandle,
    cache: Arc<Mutex<HashMap<String, CachedUrl>>>,
) -> io::Result<()> {
    let head = read_head(&mut stream)?;
    let request_line = head.lines().next().unwrap_or_default();
    if request_line.starts_with("OPTIONS ") {
        return write_preflight(&mut stream);
    }
    let range = range_header(&head);
    if let Some(media) = parse_ytg(request_line) {
        return serve_ytg(&mut stream, &media, range.as_deref());
    }
    let Some((video_id, kind)) = parse_video_request(request_line) else {
        return write_plain(&mut stream, 404, "not found");
    };
    if kind == "m3u8" {
        return serve_master(&mut stream, &app, &cache, &video_id);
    }
    serve_mp4(&mut stream, &app, &cache, &video_id, range.as_deref())
}
