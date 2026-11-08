/// `GET /video/{id}.mp4` ou `.m3u8` — videoId Innertube de 11 caracteres.
pub fn parse_video_request(line: &str) -> Option<(String, &'static str)> {
    let mut parts = line.split_whitespace();
    let method = parts.next()?;
    let target = parts.next()?;
    if method != "GET" && method != "HEAD" {
        return None;
    }
    let path = target.split('?').next().unwrap_or(target);
    let rest = path.strip_prefix("/video/")?;
    let (id, kind) = if let Some(id) = rest.strip_suffix(".mp4") {
        (id, "mp4")
    } else if let Some(id) = rest.strip_suffix(".m3u8") {
        (id, "m3u8")
    } else {
        return None;
    };
    valid_video_id(id).then(|| (id.to_string(), kind))
}

/// `GET /ytg?u=` — URL googlevideo percent-encoded, só CDN.
pub fn parse_ytg(line: &str) -> Option<String> {
    let mut parts = line.split_whitespace();
    let method = parts.next()?;
    let target = parts.next()?;
    if method != "GET" && method != "HEAD" {
        return None;
    }
    let (path, query) = target.split_once('?')?;
    if path != "/ytg" {
        return None;
    }
    for pair in query.split('&') {
        let Some((name, value)) = pair.split_once('=') else {
            continue;
        };
        if name != "u" {
            continue;
        }
        let decoded = percent_decode(value)?;
        if allowed_media_url(&decoded) {
            return Some(decoded);
        }
    }
    None
}

pub fn valid_video_id(id: &str) -> bool {
    id.len() == 11
        && id
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

/// Só CDN googlevideo; o player nunca fala com o host direto.
pub fn allowed_media_url(raw: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(raw) else {
        return false;
    };
    url.scheme() == "https"
        && url
            .host_str()
            .is_some_and(|host| host.ends_with("googlevideo.com"))
}

/// Playlist HLS termina em `.m3u8`. O `seg.ts` da live traz `/index.m3u8/` no meio do path.
pub fn is_hls_playlist_url(raw: &str) -> bool {
    reqwest::Url::parse(raw)
        .ok()
        .is_some_and(|url| url.path().ends_with(".m3u8"))
}

pub fn range_header(head: &str) -> Option<String> {
    for line in head.lines() {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        if name.trim().eq_ignore_ascii_case("range") {
            return Some(value.trim().to_string());
        }
    }
    None
}

fn percent_encode(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len() * 3);
    for &byte in raw.as_bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

fn percent_decode(raw: &str) -> Option<String> {
    let bytes = raw.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return None;
            }
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).ok()?;
            out.push(u8::from_str_radix(hex, 16).ok()?);
            i += 3;
        } else {
            out.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(out).ok()
}

struct MasterVariant {
    bandwidth: u64,
    inf: String,
    uri: String,
}

fn bandwidth_of(inf: &str) -> u64 {
    inf.split_once("BANDWIDTH=")
        .and_then(|(_, rest)| {
            rest.chars()
                .take_while(|ch| ch.is_ascii_digit())
                .collect::<String>()
                .parse()
                .ok()
        })
        .unwrap_or(0)
}

fn take_stream_inf(pending: &mut Option<String>, line: &str) -> Option<MasterVariant> {
    let inf = pending.take()?;
    Some(MasterVariant {
        bandwidth: bandwidth_of(&inf),
        inf,
        uri: line.to_string(),
    })
}

fn split_master_variants(body: &str) -> (Vec<String>, Vec<MasterVariant>, Vec<String>) {
    let mut header = Vec::new();
    let mut variants = Vec::new();
    let mut trailing = Vec::new();
    let mut pending = None;
    let mut seen = false;
    for line in body.lines() {
        if let Some(variant) = take_stream_inf(&mut pending, line) {
            variants.push(variant);
            seen = true;
            continue;
        }
        if line.starts_with("#EXT-X-STREAM-INF:") {
            pending = Some(line.to_string());
            continue;
        }
        if seen {
            trailing.push(line.to_string());
        } else {
            header.push(line.to_string());
        }
    }
    (header, variants, trailing)
}

fn join_master_playlist(
    header: &[String],
    variants: &[MasterVariant],
    trailing: &[String],
    ends_with_newline: bool,
) -> String {
    let mut lines = Vec::with_capacity(header.len() + variants.len() * 2 + trailing.len());
    lines.extend(header.iter().cloned());
    for variant in variants {
        lines.push(variant.inf.clone());
        lines.push(variant.uri.clone());
    }
    lines.extend(trailing.iter().cloned());
    let mut out = lines.join("\n");
    if ends_with_newline {
        out.push('\n');
    }
    out
}

/// AVPlayer/WKWebView começa no primeiro STREAM-INF; o YouTube manda 144p primeiro.
fn prefer_highest_variant(body: &str) -> String {
    if !body.contains("#EXT-X-STREAM-INF:") {
        return body.to_string();
    }
    let (header, mut variants, trailing) = split_master_variants(body);
    variants.sort_by(|left, right| right.bandwidth.cmp(&left.bandwidth));
    join_master_playlist(&header, &variants, &trailing, body.ends_with('\n'))
}

/// Reescreve URLs googlevideo da playlist para `http://127.0.0.1:{port}/ytg?u=`.
pub fn rewrite_hls_playlist(body: &str, proxy_base: &str) -> String {
    let base = proxy_base.trim_end_matches('/');
    let rewritten: String = body
        .split_inclusive('\n')
        .map(|line| rewrite_line(line, base))
        .collect();
    prefer_highest_variant(&rewritten)
}

fn rewrite_line(line: &str, base: &str) -> String {
    let mut out = String::with_capacity(line.len() + 32);
    let bytes = line.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i..].starts_with(b"https://") {
            let rest = &line[i..];
            let end = rest
                .find(|ch: char| ch == '"' || ch == '\'' || ch.is_ascii_whitespace())
                .unwrap_or(rest.len());
            let url = &rest[..end];
            if url.contains("googlevideo.com") {
                out.push_str(base);
                out.push_str("/ytg?u=");
                out.push_str(&percent_encode(url));
                i += end;
                continue;
            }
        }
        out.push(bytes[i] as char);
        i += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::{
        allowed_media_url, is_hls_playlist_url, parse_video_request, parse_ytg, range_header,
        rewrite_hls_playlist, valid_video_id,
    };

    #[test]
    fn parse_video_request_so_mp4_de_11_chars() {
        assert_eq!(
            parse_video_request("GET /video/dQw4w9WgXcQ.mp4 HTTP/1.1"),
            Some(("dQw4w9WgXcQ".into(), "mp4"))
        );
        assert_eq!(
            parse_video_request("GET /video/dQw4w9WgXcQ.mp4? HTTP/1.1"),
            Some(("dQw4w9WgXcQ".into(), "mp4"))
        );
        assert_eq!(
            parse_video_request("GET /video/dQw4w9WgXcQ.m3u8 HTTP/1.1"),
            Some(("dQw4w9WgXcQ".into(), "m3u8"))
        );
        assert_eq!(parse_video_request("GET /video/abc.mp4 HTTP/1.1"), None);
        assert_eq!(
            parse_video_request("POST /video/dQw4w9WgXcQ.mp4 HTTP/1.1"),
            None
        );
        assert_eq!(parse_video_request("GET /audio/dQw4w9WgXcQ HTTP/1.1"), None);
    }

    #[test]
    fn valid_video_id_rejeita_curto_e_lixo() {
        assert!(valid_video_id("abcdefghijk"));
        assert!(!valid_video_id("abc"));
        assert!(!valid_video_id("abcdefghij "));
    }

    #[test]
    fn allowed_media_url_so_googlevideo_https() {
        assert!(allowed_media_url(
            "https://rr1---sn-host.googlevideo.com/videoplayback?id=x"
        ));
        assert!(!allowed_media_url(
            "http://rr1---sn-host.googlevideo.com/videoplayback"
        ));
        assert!(!allowed_media_url("https://www.youtube.com/watch?v=x"));
    }

    #[test]
    fn range_header_lê_bytes() {
        let head = "GET /video/dQw4w9WgXcQ.mp4 HTTP/1.1\r\nRange: bytes=0-1023\r\n\r\n";
        assert_eq!(range_header(head).as_deref(), Some("bytes=0-1023"));
    }

    #[test]
    fn rewrite_hls_playlist_aponta_googlevideo_para_o_proxy() {
        let body =
            "#EXTM3U\nhttps://manifest.googlevideo.com/api/manifest/hls_playlist/x/index.m3u8\n";
        let rewritten = rewrite_hls_playlist(body, "http://127.0.0.1:43111");
        assert!(rewritten.contains("http://127.0.0.1:43111/ytg?u="));
        assert!(!rewritten.contains("https://manifest.googlevideo.com"));
        assert!(rewritten.starts_with("#EXTM3U"));
    }

    #[test]
    fn rewrite_hls_playlist_coloca_maior_bandwidth_primeiro() {
        let body = concat!(
            "#EXTM3U\n",
            "#EXT-X-INDEPENDENT-SEGMENTS\n",
            "#EXT-X-STREAM-INF:BANDWIDTH=269034,RESOLUTION=256x144\n",
            "https://manifest.googlevideo.com/low/index.m3u8\n",
            "#EXT-X-STREAM-INF:BANDWIDTH=5552610,RESOLUTION=1920x1080\n",
            "https://manifest.googlevideo.com/high/index.m3u8\n",
        );
        let rewritten = rewrite_hls_playlist(body, "http://127.0.0.1:43111");
        let lines: Vec<&str> = rewritten.lines().collect();
        assert_eq!(lines[0], "#EXTM3U");
        assert_eq!(lines[1], "#EXT-X-INDEPENDENT-SEGMENTS");
        assert!(
            lines[2].contains("BANDWIDTH=5552610"),
            "primeiro nível deveria ser 1080p, recebido {}",
            lines[2]
        );
        assert!(lines[3].contains("high"));
        assert!(lines[4].contains("BANDWIDTH=269034"));
        assert!(lines[5].contains("low"));
    }

    #[test]
    fn parse_ytg_decodifica_u_do_proxy() {
        let body =
            "#EXTM3U\nhttps://manifest.googlevideo.com/api/manifest/hls_playlist/x/index.m3u8\n";
        let rewritten = rewrite_hls_playlist(body, "http://127.0.0.1:43111");
        let line = rewritten.lines().nth(1).unwrap();
        let path = line.trim_start_matches("http://127.0.0.1:43111");
        let request = format!("GET {path} HTTP/1.1");
        assert_eq!(
            parse_ytg(&request).as_deref(),
            Some("https://manifest.googlevideo.com/api/manifest/hls_playlist/x/index.m3u8")
        );
    }

    #[test]
    fn parse_ytg_recusa_host_que_nao_e_googlevideo() {
        assert_eq!(
            parse_ytg("GET /ytg?u=https%3A%2F%2Fwww.youtube.com%2Fwatch HTTP/1.1"),
            None
        );
        assert_eq!(parse_ytg("GET /video/dQw4w9WgXcQ.mp4 HTTP/1.1"), None);
        assert_eq!(
            parse_ytg("POST /ytg?u=https%3A%2F%2Frr1.googlevideo.com%2Fx HTTP/1.1"),
            None
        );
    }

    #[test]
    fn is_hls_playlist_url_so_quando_o_path_termina_em_m3u8() {
        assert!(is_hls_playlist_url(
            "https://manifest.googlevideo.com/api/manifest/hls_playlist/x/playlist/index.m3u8"
        ));
        assert!(is_hls_playlist_url(
            "https://manifest.googlevideo.com/api/manifest/hls_variant/x/file/index.m3u8?expire=1"
        ));
        assert!(!is_hls_playlist_url(
            "https://rr1---sn-host.googlevideo.com/videoplayback/id/abcdefghijk.1/playlist/index.m3u8/sq/5345/file/seg.ts"
        ));
    }
}
