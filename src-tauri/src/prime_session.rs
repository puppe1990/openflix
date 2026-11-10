//! Sessão de playback do Prime: repete o PRS oficial com o mesmo envelope e
//! corpo que o JS da Amazon mintou na página. Cada PRS devolve handoff,
//! certificado e URLs próprios. O painel oficial gasta a sessão dele na licença
//! dele, então o player nativo cunha outra antes de pedir a própria licença
//! FairPlay. Nada é inventado aqui: mesmo corpo, mesmo cookie, mesmo endpoint
//! que a página já chamou.

use tauri::{AppHandle, Url};

use crate::prime_window::SAFARI_UA;
use crate::secrets;

const PS_HOST: &str = "atv-ps.primevideo.com";
const COOKIE_ACCOUNT: &str = "prime_cookie";
/// Corpo do PRS real fica em ~4 KB; acima disso é página fazendo coisa errada.
const MAX_BODY: usize = 65_536;

/// Só os PRS oficiais do atv-ps: nada de URL arbitrária.
pub fn allowed_session_url(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    url.scheme() == "https"
        && url.host_str() == Some(PS_HOST)
        && matches!(
            url.path(),
            "/playback/prs/GetVodPlaybackResources"
                | "/playback/prs/GetLivePlaybackResources"
                | "/playback/prs/GetLiveLinearPlaybackResources"
        )
}

/// Corpo precisa ser o JSON do PRS, não texto solto.
pub fn require_body(body: &str) -> Result<(), String> {
    if body.trim().is_empty() {
        return Err(
            "sessão do prime recusada: recebido corpo vazio, esperado JSON do PRS".to_string(),
        );
    }
    if body.len() > MAX_BODY {
        return Err(format!(
            "sessão do prime recusada: recebido corpo de {} bytes, esperado até {MAX_BODY}",
            body.len()
        ));
    }
    serde_json::from_str::<serde_json::Value>(body).map_err(|error| {
        format!(
            "sessão do prime recusada: recebido {} ({error}), esperado JSON do PRS",
            body.chars().take(120).collect::<String>()
        )
    })?;
    Ok(())
}

fn snippet(text: &str) -> String {
    text.chars().take(200).collect()
}

/// POST no PRS oficial e devolve o JSON cru com handoff, certificado e URLs.
pub async fn mint(app: &AppHandle, url: &str, body: &str) -> Result<String, String> {
    if !allowed_session_url(url) {
        return Err(format!(
            "sessão do prime recusada: recebido {url}, esperado https://{PS_HOST}/playback/prs/Get*PlaybackResources"
        ));
    }
    require_body(body)?;
    let client = reqwest::Client::builder()
        .gzip(true)
        .build()
        .map_err(|error| {
            format!("sessão do prime recusada: recebido {error}, esperado cliente HTTP")
        })?;
    let mut builder = client
        .post(url)
        .header("accept", "*/*")
        .header("accept-language", "pt-BR,pt;q=0.9")
        .header("user-agent", SAFARI_UA)
        .header("origin", "https://www.primevideo.com")
        .header("referer", "https://www.primevideo.com/")
        .header("content-type", "application/json")
        .body(body.to_string());
    if let Some(cookie) = secrets::get(app, COOKIE_ACCOUNT)?.filter(|item| !item.is_empty()) {
        builder = builder.header("cookie", cookie);
    }
    let response = builder
        .send()
        .await
        .map_err(|error| format!("sessão do prime recusada: recebido {error}, esperado HTTP"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("sessão do prime recusada: recebido {error}, esperado corpo"))?;
    if !status.is_success() {
        return Err(format!(
            "sessão do prime recusada: recebido HTTP {status} {}, esperado 2xx",
            snippet(&text)
        ));
    }
    Ok(text)
}

#[cfg(test)]
mod tests {
    use super::{allowed_session_url, require_body, MAX_BODY};

    #[test]
    fn allowlist_so_prs_do_atv_ps() {
        assert!(allowed_session_url(
            "https://atv-ps.primevideo.com/playback/prs/GetVodPlaybackResources?titleId=x"
        ));
        assert!(allowed_session_url(
            "https://atv-ps.primevideo.com/playback/prs/GetLivePlaybackResources?titleId=x"
        ));
        assert!(allowed_session_url(
            "https://atv-ps.primevideo.com/playback/prs/GetLiveLinearPlaybackResources?titleId=x"
        ));
        assert!(!allowed_session_url(
            "https://atv-ps.primevideo.com/playback/prs/GetSomethingElse"
        ));
        assert!(!allowed_session_url(
            "http://atv-ps.primevideo.com/playback/prs/GetVodPlaybackResources"
        ));
        assert!(!allowed_session_url(
            "https://atv-ps.primevideo.com.evil.net/playback/prs/GetVodPlaybackResources"
        ));
        assert!(!allowed_session_url(
            "https://www.primevideo.com/playback/prs/GetVodPlaybackResources"
        ));
    }

    #[test]
    fn require_body_aceita_json_e_recusa_texto_ou_excesso() {
        assert!(require_body(r#"{"globalParameters":{}}"#).is_ok());
        assert!(require_body("  ").unwrap_err().contains("corpo vazio"));
        assert!(require_body("não é json")
            .unwrap_err()
            .contains("esperado JSON"));
        let huge = format!(r#"{{"x":"{}"}}"#, "a".repeat(MAX_BODY));
        assert!(require_body(&huge).unwrap_err().contains("esperado até"));
    }
}
