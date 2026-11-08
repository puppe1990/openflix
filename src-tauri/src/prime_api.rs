use crate::secrets;

const ORIGIN: &str = "https://www.primevideo.com";
const COOKIE_ACCOUNT: &str = "prime_cookie";
const USER_AGENT: &str =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

/// Só o BFF de loja: nav e landing. Playback/DRM ficam de fora.
pub fn allowed(method: &str, path: &str) -> bool {
    matches!(
        (method, path),
        ("GET", "/api/enrichNav") | ("POST", "/api/getLandingPage")
    )
}

fn url_for(path: &str) -> String {
    if path == "/api/enrichNav" {
        return format!("{ORIGIN}{path}?enrichmentType=GET_CATEGORIES");
    }
    format!("{ORIGIN}{path}")
}

fn attach_cookie(
    mut builder: reqwest::RequestBuilder,
    cookie: Option<String>,
) -> reqwest::RequestBuilder {
    builder = builder
        .header("accept", "*/*")
        .header("accept-language", "pt-BR,pt;q=0.9")
        .header("user-agent", USER_AGENT)
        .header("x-requested-with", "XMLHttpRequest");
    if let Some(value) = cookie.filter(|item| !item.is_empty()) {
        builder = builder.header("cookie", value);
    }
    builder
}

/// GET enrichNav ou POST getLandingPage, com cookie do cofre se existir.
pub async fn request(
    app: &tauri::AppHandle,
    method: &str,
    path: &str,
    body: Option<&str>,
) -> Result<String, String> {
    if !allowed(method, path) {
        return Err(format!(
            "endpoint do prime recusado: recebido {method} {path}, esperado GET /api/enrichNav ou POST /api/getLandingPage"
        ));
    }
    let cookie = secrets::get(app, COOKIE_ACCOUNT)?;
    let client = reqwest::Client::builder()
        .gzip(true)
        .build()
        .map_err(|error| format!("prime recusou: recebido {error}, esperado cliente HTTP"))?;
    let url = url_for(path);
    let builder = match method {
        "GET" => attach_cookie(client.get(&url), cookie),
        "POST" => attach_cookie(client.post(&url), cookie)
            .header(
                "content-type",
                "application/x-www-form-urlencoded;charset=UTF-8",
            )
            .body(body.unwrap_or("").to_string()),
        other => {
            return Err(format!(
                "endpoint do prime recusado: recebido {other} {path}, esperado GET /api/enrichNav ou POST /api/getLandingPage"
            ));
        }
    };
    let response = builder
        .send()
        .await
        .map_err(|error| format!("prime recusou: recebido {error}, esperado resposta HTTP"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("prime recusou: recebido {error}, esperado corpo JSON"))?;
    if !status.is_success() {
        return Err(format!(
            "prime recusou: recebido HTTP {status}, esperado 2xx"
        ));
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::allowed;

    #[test]
    fn allowlist_so_nav_e_landing() {
        assert!(allowed("GET", "/api/enrichNav"));
        assert!(allowed("POST", "/api/getLandingPage"));
        assert!(!allowed("POST", "/api/enrichNav"));
        assert!(!allowed("GET", "/playback/prs/GetVodPlaybackResources"));
        assert!(!allowed("POST", "/api/enrichItemMetadata"));
    }
}
