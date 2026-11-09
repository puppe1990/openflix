/// n-sig das URLs googlevideo (WEB HLS e itag 18). Sem o transform o CDN responde 403.
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

use crate::youtube_api::innertube_user_agent;

pub const IFRAME_API_URL: &str = "https://www.youtube.com/iframe_api";
static ENGINE: OnceLock<Mutex<NsigEngine>> = OnceLock::new();

fn engine() -> &'static Mutex<NsigEngine> {
    ENGINE.get_or_init(|| Mutex::new(NsigEngine::new()))
}

pub fn n_param_from_url(url: &str) -> Option<&str> {
    n_param_span(url).map(|(start, end)| &url[start..end])
}

pub fn replace_n_param(url: &str, solved: &str) -> String {
    let Some((start, end)) = n_param_span(url) else {
        return url.to_string();
    };
    let mut out = String::with_capacity(url.len() - (end - start) + solved.len());
    out.push_str(&url[..start]);
    out.push_str(solved);
    out.push_str(&url[end..]);
    out
}

/// Troca o `n` cru pelo valor resolvido. Sem `n`, devolve a URL intacta.
pub fn descramble_url(
    url: &str,
    solve: impl Fn(&str) -> Result<String, String>,
) -> Result<String, String> {
    let Some(n) = n_param_from_url(url) else {
        return Ok(url.to_string());
    };
    let solved = solve(n)?;
    if !valid_solved_n(n, &solved) {
        return Err(format!(
            "n-sig recusado: recebido {solved}, esperado transform diferente de {n}"
        ));
    }
    Ok(replace_n_param(url, &solved))
}

pub fn player_id_from_text(text: &str) -> Option<String> {
    for marker in ["/s/player/", r"\/s\/player\/"] {
        if let Some(id) = player_id_after(text, marker) {
            return Some(id);
        }
    }
    None
}

pub fn player_js_url(player_id: &str) -> String {
    format!("https://www.youtube.com/s/player/{player_id}/player_ias.vflset/en_US/base.js")
}

const EJS_LIB: &str = include_str!("../ejs/yt.solver.lib.min.js");
const EJS_CORE: &str = include_str!("../ejs/yt.solver.core.min.js");
/// Roda o programa EJS (`jsc`) e devolve o JSON de saída.
pub fn run_jsc(prelude: &str, input: &serde_json::Value) -> Result<serde_json::Value, String> {
    let runtime = rquickjs::Runtime::new().map_err(js_error)?;
    runtime.set_max_stack_size(8 * 1024 * 1024);
    let context = rquickjs::Context::full(&runtime).map_err(js_error)?;
    let payload = serde_json::to_string(input)
        .map_err(|error| format!("n-sig recusado: recebido {error}, esperado JSON do jsc"))?;
    let raw = context.with(|ctx| -> Result<String, String> {
        use rquickjs::CatchResultExt;
        ctx.eval::<(), _>(prelude).catch(&ctx).map_err(js_error)?;
        ctx.globals()
            .set("INPUT_JSON", payload.as_str())
            .map_err(js_error)?;
        ctx.eval::<String, _>("JSON.stringify(jsc(JSON.parse(INPUT_JSON)))")
            .catch(&ctx)
            .map_err(js_error)
    })?;
    serde_json::from_str(&raw)
        .map_err(|error| format!("n-sig recusado: recebido {error}, esperado JSON do jsc"))
}

/// Resolve um desafio `n` com o player JS e os scripts EJS (yt-dlp/ejs 0.8.0).
pub fn solve_n(player_js: &str, n: &str) -> Result<String, String> {
    let prelude = format!("{EJS_LIB}\nObject.assign(globalThis, lib);\n{EJS_CORE}");
    let input = serde_json::json!({
        "type": "player",
        "player": player_js,
        "requests": [{ "type": "n", "challenges": [n] }],
        "output_preprocessed": false
    });
    n_from_jsc(&run_jsc(&prelude, &input)?, n)
}

fn n_from_jsc(output: &serde_json::Value, n: &str) -> Result<String, String> {
    if output.get("type").and_then(|item| item.as_str()) == Some("error") {
        return Err(format!(
            "n-sig recusado: recebido {}, esperado jsc result",
            output
                .get("error")
                .and_then(|item| item.as_str())
                .unwrap_or("erro")
        ));
    }
    let response = output
        .pointer("/responses/0")
        .ok_or_else(|| "n-sig recusado: recebido jsc sem responses, esperado 1".to_string())?;
    if response.get("type").and_then(|item| item.as_str()) == Some("error") {
        return Err(format!(
            "n-sig recusado: recebido {}, esperado função n no player",
            response
                .get("error")
                .and_then(|item| item.as_str())
                .unwrap_or("erro")
        ));
    }
    let solved = response
        .pointer("/data")
        .and_then(|data| data.get(n))
        .and_then(|item| item.as_str())
        .ok_or_else(|| {
            format!("n-sig recusado: recebido sem resultado para {n}, esperado data[{n}]")
        })?;
    if !valid_solved_n(n, solved) {
        return Err(format!(
            "n-sig recusado: recebido {solved}, esperado transform diferente de {n}"
        ));
    }
    Ok(solved.to_string())
}

fn js_error(error: impl std::fmt::Display) -> String {
    format!("n-sig recusado: recebido {error}, esperado QuickJS")
}

pub struct NsigEngine {
    player_js: Option<String>,
    solved: HashMap<String, String>,
}

impl NsigEngine {
    pub fn new() -> Self {
        Self {
            player_js: None,
            solved: HashMap::new(),
        }
    }

    pub fn descramble_with(
        &mut self,
        url: &str,
        fetch: impl Fn(&str) -> Result<String, String>,
        solve: impl Fn(&str, &str) -> Result<String, String>,
    ) -> Result<String, String> {
        let Some(n) = n_param_from_url(url).map(str::to_string) else {
            return Ok(url.to_string());
        };
        if let Some(solved) = self.solved.get(&n) {
            return Ok(replace_n_param(url, solved));
        }
        let player = self.ensure_player(&fetch)?;
        let solved = solve(&player, &n)?;
        if !valid_solved_n(&n, &solved) {
            return Err(format!(
                "n-sig recusado: recebido {solved}, esperado transform diferente de {n}"
            ));
        }
        self.solved.insert(n, solved.clone());
        Ok(replace_n_param(url, &solved))
    }

    fn ensure_player(
        &mut self,
        fetch: &impl Fn(&str) -> Result<String, String>,
    ) -> Result<String, String> {
        if let Some(js) = &self.player_js {
            return Ok(js.clone());
        }
        let iframe = fetch(IFRAME_API_URL)?;
        let id = player_id_from_text(&iframe).ok_or_else(|| {
            "n-sig recusado: recebido iframe_api sem player id, esperado /s/player/HASH/"
                .to_string()
        })?;
        let js = fetch(&player_js_url(&id))?;
        if js.len() < 1000 {
            return Err(format!(
                "n-sig recusado: recebido player {} bytes, esperado base.js",
                js.len()
            ));
        }
        self.player_js = Some(js.clone());
        Ok(js)
    }
}

pub fn descramble_media(url: &str) -> String {
    let Ok(mut engine) = engine().lock() else {
        return url.to_string();
    };
    engine
        .descramble_with(url, http_get, solve_n)
        .unwrap_or_else(|_| url.to_string())
}

/// Baixa o player JS na subida do proxy pra primeira live não pagar o GET.
pub fn prefetch_player() {
    if let Ok(mut engine) = engine().lock() {
        let _ = engine.ensure_player(&http_get);
    }
}

fn http_get(url: &str) -> Result<String, String> {
    let response = reqwest::blocking::Client::builder()
        .gzip(true)
        .http1_only() // www.youtube.com recusa HTTP/2 rustls (stream error)
        .timeout(Duration::from_secs(25))
        .build()
        .map_err(|error| format!("n-sig recusado: recebido {error}, esperado cliente HTTP"))?
        .get(url)
        .header("user-agent", innertube_user_agent("WEB"))
        .header("accept", "*/*")
        .send()
        .map_err(|error| format!("n-sig recusado: recebido {error}, esperado GET {url}"))?;
    let status = response.status();
    let body = response
        .text()
        .map_err(|error| format!("n-sig recusado: recebido {error}, esperado texto de {url}"))?;
    if !status.is_success() {
        return Err(format!(
            "n-sig recusado: recebido HTTP {status} em {url}, esperado 2xx"
        ));
    }
    Ok(body)
}

fn n_param_span(url: &str) -> Option<(usize, usize)> {
    path_n_span(url).or_else(|| query_n_span(url))
}

fn path_n_span(url: &str) -> Option<(usize, usize)> {
    let bytes = url.as_bytes();
    let mut i = 0;
    while i + 3 < bytes.len() {
        if bytes[i] == b'/' && bytes[i + 1] == b'n' && bytes[i + 2] == b'/' {
            let start = i + 3;
            let end = url[start..]
                .find('/')
                .map(|offset| start + offset)
                .unwrap_or(url.len());
            if start < end {
                return Some((start, end));
            }
        }
        i += 1;
    }
    None
}

fn query_n_span(url: &str) -> Option<(usize, usize)> {
    let query_at = url.find('?')?;
    let query = &url[query_at + 1..];
    let mut offset = 0;
    for pair in query.split('&') {
        if let Some(value) = pair.strip_prefix("n=") {
            if !value.is_empty() {
                let start = query_at + 1 + offset + 2;
                return Some((start, start + value.len()));
            }
        }
        offset += pair.len() + 1;
    }
    None
}

fn valid_solved_n(original: &str, solved: &str) -> bool {
    !solved.is_empty() && solved != original && !solved.ends_with(original)
}

fn player_id_after(text: &str, marker: &str) -> Option<String> {
    let rest = text.split_once(marker)?.1;
    let id: String = rest
        .chars()
        .take_while(|ch| ch.is_ascii_hexdigit())
        .collect();
    (id.len() >= 8).then_some(id)
}

#[cfg(test)]
mod tests {
    use super::{
        descramble_url, n_param_from_url, player_id_from_text, player_js_url, replace_n_param,
        run_jsc, solve_n, NsigEngine, IFRAME_API_URL,
    };

    const PATH_N: &str = "jkdACXzMJ-pXhN9LF9";
    const QUERY_N: &str = "abcDEF1234567890xy";

    fn hls_segment(n: &str) -> String {
        format!(
            "https://rr2---sn-host.googlevideo.com/videoplayback/id/0QYNVo7UroY.1/itag/301/ns/CetXxjKh29SUfeUJzfoIpFsZ/n/{n}/mt/1/file/seg.ts"
        )
    }

    fn vod_mp4(n: &str) -> String {
        format!("https://rr1---sn-host.googlevideo.com/videoplayback?expire=1&n={n}&itag=18")
    }

    fn reverse_n(n: &str) -> Result<String, String> {
        Ok(n.chars().rev().collect())
    }

    #[test]
    fn n_param_pega_path_e_ignora_ns() {
        let url = hls_segment(PATH_N);
        assert_eq!(n_param_from_url(&url), Some(PATH_N));
        assert!(!n_param_from_url(&url).unwrap().starts_with("CetXx"));
    }

    #[test]
    fn n_param_pega_query_do_itag_18() {
        assert_eq!(n_param_from_url(&vod_mp4(QUERY_N)), Some(QUERY_N));
    }

    #[test]
    fn n_param_ausente_em_playlist() {
        assert_eq!(
            n_param_from_url(
                "https://manifest.googlevideo.com/api/manifest/hls_variant/x/file/index.m3u8"
            ),
            None
        );
    }

    #[test]
    fn replace_n_param_troca_so_o_n_do_path() {
        let url = hls_segment(PATH_N);
        let solved = reverse_n(PATH_N).unwrap();
        let rewritten = replace_n_param(&url, &solved);
        assert!(rewritten.contains(&format!("/n/{solved}/")));
        assert!(!rewritten.contains(&format!("/n/{PATH_N}/")));
        assert!(rewritten.contains("/ns/CetXxjKh29SUfeUJzfoIpFsZ/"));
    }

    #[test]
    fn replace_n_param_troca_so_o_n_da_query() {
        let rewritten = replace_n_param(&vod_mp4(QUERY_N), "solvedNvalue12ab");
        assert!(rewritten.contains("n=solvedNvalue12ab"));
        assert!(!rewritten.contains(&format!("n={QUERY_N}")));
        assert!(rewritten.contains("itag=18"));
    }

    #[test]
    fn descramble_url_aplica_solver_no_n() {
        let url = hls_segment(PATH_N);
        let rewritten = descramble_url(&url, reverse_n).unwrap();
        let solved = reverse_n(PATH_N).unwrap();
        assert_eq!(n_param_from_url(&rewritten), Some(solved.as_str()));
    }

    #[test]
    fn descramble_url_sem_n_devolve_igual() {
        let url = "https://manifest.googlevideo.com/api/manifest/hls_variant/x/file/index.m3u8";
        assert_eq!(descramble_url(url, reverse_n).unwrap(), url);
    }

    #[test]
    fn descramble_url_recusa_solver_identidade() {
        let err = descramble_url(&hls_segment(PATH_N), |n| Ok(n.to_string())).unwrap_err();
        assert!(err.contains("n-sig recusado"));
        assert!(err.contains(PATH_N));
    }

    #[test]
    fn player_id_le_iframe_api_escapada() {
        let iframe = r"var scriptUrl = 'https:\/\/www.youtube.com\/s\/player\/a5c2aafe\/www-widgetapi.vflset\/www-widgetapi.js';";
        assert_eq!(player_id_from_text(iframe).as_deref(), Some("a5c2aafe"));
    }

    #[test]
    fn player_id_le_player_js_url_do_html() {
        let html =
            r#"ytcfg.set({"PLAYER_JS_URL":"/s/player/a5c2aafe/player_es6.vflset/pt_BR/base.js"})"#;
        assert_eq!(player_id_from_text(html).as_deref(), Some("a5c2aafe"));
    }

    #[test]
    fn player_js_url_usa_ias_en_us() {
        let url = player_js_url("a5c2aafe");
        assert_eq!(
            url,
            "https://www.youtube.com/s/player/a5c2aafe/player_ias.vflset/en_US/base.js"
        );
        assert!(!url.contains("player_es6"));
        assert!(!url.contains("music.youtube.com"));
    }

    #[test]
    fn run_jsc_executa_solver_stub() {
        let prelude = r#"
            var jsc = function (input) {
                return {
                    type: "result",
                    responses: input.requests.map(function (req) {
                        var data = {};
                        req.challenges.forEach(function (item) {
                            data[item] = item.split("").reverse().join("");
                        });
                        return { type: "result", data: data };
                    })
                };
            };
        "#;
        let input = serde_json::json!({
            "type": "player",
            "player": "fake-player",
            "requests": [{ "type": "n", "challenges": ["jkdACXzMJ"] }]
        });
        let output = run_jsc(prelude, &input).unwrap();
        assert_eq!(output["type"], "result");
        assert_eq!(output["responses"][0]["data"]["jkdACXzMJ"], "JMzXCAdkj");
    }

    #[test]
    fn solve_n_recusa_player_sem_funcao_n() {
        let err = solve_n("var unused = 1;", PATH_N).unwrap_err();
        assert!(err.contains("n-sig recusado"));
        assert!(!err.contains("solver ausente"));
    }

    fn fake_fetch(url: &str) -> Result<String, String> {
        if url == IFRAME_API_URL {
            return Ok(
                r"var scriptUrl = 'https:\/\/www.youtube.com\/s\/player\/a5c2aafe\/www-widgetapi.vflset\/www-widgetapi.js';"
                    .into(),
            );
        }
        if url.contains("player_ias.vflset/en_US/base.js") {
            return Ok("x".repeat(2000));
        }
        Err(format!("fetch inesperado: {url}"))
    }

    #[test]
    fn engine_busca_player_uma_vez_e_cacheia_n() {
        let mut engine = NsigEngine::new();
        let fetches = std::cell::RefCell::new(Vec::new());
        let url = hls_segment(PATH_N);
        let solve = |_player: &str, n: &str| reverse_n(n);
        let first = engine
            .descramble_with(
                &url,
                |item| {
                    fetches.borrow_mut().push(item.to_string());
                    fake_fetch(item)
                },
                solve,
            )
            .unwrap();
        let second = engine
            .descramble_with(
                &url,
                |item| {
                    fetches.borrow_mut().push(item.to_string());
                    fake_fetch(item)
                },
                solve,
            )
            .unwrap();
        assert_eq!(first, second);
        let solved = reverse_n(PATH_N).unwrap();
        assert_eq!(n_param_from_url(&first), Some(solved.as_str()));
        let urls = fetches.borrow().clone();
        assert_eq!(
            urls.len(),
            2,
            "segunda URL deveria sair do cache, recebido {urls:?}"
        );
        assert_eq!(urls[0], IFRAME_API_URL);
        assert!(urls[1].contains("/s/player/a5c2aafe/player_ias.vflset/en_US/base.js"));
    }

    #[test]
    fn engine_playlist_sem_n_nao_busca() {
        let mut engine = NsigEngine::new();
        let fetches = std::cell::RefCell::new(Vec::new());
        let url = "https://manifest.googlevideo.com/api/manifest/hls_variant/x/file/index.m3u8";
        let out = engine
            .descramble_with(
                url,
                |item| {
                    fetches.borrow_mut().push(item.to_string());
                    fake_fetch(item)
                },
                |_, n| reverse_n(n),
            )
            .unwrap();
        assert_eq!(out, url);
        assert!(fetches.borrow().is_empty());
    }
}
