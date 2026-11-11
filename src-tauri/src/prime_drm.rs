//! Licença FairPlay do Prime Video pelo endpoint oficial que o player web da
//! Amazon chama. O OpenFlix manda o desafio (SPC) do CDM do sistema junto do
//! `playbackEnvelope` e do `sessionHandoffToken` mintados pelo JS oficial da
//! Amazon; recebe o CKC de volta. Nenhuma chave é fabricada aqui.

use tauri::{AppHandle, Url};

use crate::prime_window::SAFARI_UA;
use crate::secrets;

const LICENSE_HOST: &str = "atv-ps.primevideo.com";
const LICENSE_PATH: &str = "/playback/drm-vod/GetFairPlayLicense";
const LIVE_LICENSE_PATH: &str = "/playback/drm-live/GetFairPlayLicense";
const LINEAR_LICENSE_PATH: &str = "/playback/drm-linear/GetFairPlayLicense";
const COOKIE_ACCOUNT: &str = "prime_cookie";

/// Só o endpoint de licença FairPlay do atv-ps: nada de URL arbitrária.
pub fn allowed_license_url(raw: &str) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    if url.scheme() != "https" || url.host_str() != Some(LICENSE_HOST) {
        return false;
    }
    matches!(
        url.path(),
        LICENSE_PATH | LIVE_LICENSE_PATH | LINEAR_LICENSE_PATH
    )
}

fn require_field(value: &str, name: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!(
            "licença do prime recusada: recebido {name} vazio, esperado token do oráculo"
        ));
    }
    Ok(())
}

fn snippet(text: &str) -> String {
    text.chars().take(200).collect()
}

/// CKC dentro da resposta JSON do endpoint.
pub fn license_from_response(text: &str) -> Result<String, String> {
    let value: serde_json::Value = serde_json::from_str(text).map_err(|error| {
        format!(
            "licença do prime recusada: recebido {} ({error}), esperado JSON",
            snippet(text)
        )
    })?;
    value
        .pointer("/fairPlayLicense/license")
        .and_then(serde_json::Value::as_str)
        .filter(|license| !license.is_empty())
        .map(str::to_string)
        .ok_or_else(|| {
            format!(
                "licença do prime recusada: recebido {}, esperado fairPlayLicense.license",
                snippet(text)
            )
        })
}

/// POST no endpoint oficial com envelope, handoff e o desafio do nosso CDM.
pub async fn license(
    app: &AppHandle,
    url: &str,
    envelope: &str,
    handoff: &str,
    challenge: &str,
) -> Result<String, String> {
    require_field(envelope, "playbackEnvelope")?;
    require_field(handoff, "sessionHandoffToken")?;
    require_field(challenge, "licenseChallenge")?;
    if !allowed_license_url(url) {
        return Err(format!(
            "licença do prime recusada: recebido {url}, esperado https://{LICENSE_HOST}/playback/drm-*/GetFairPlayLicense"
        ));
    }
    let client = reqwest::Client::builder()
        .gzip(true)
        .build()
        .map_err(|error| {
            format!("licença do prime recusada: recebido {error}, esperado cliente HTTP")
        })?;
    let body = serde_json::json!({
        "playbackEnvelope": envelope,
        "sessionHandoffToken": handoff,
        "licenseChallenge": challenge,
    });
    let mut builder = client
        .post(url)
        .header("accept", "*/*")
        .header("accept-language", "pt-BR,pt;q=0.9")
        .header("user-agent", SAFARI_UA)
        .header("origin", "https://www.primevideo.com")
        .header("referer", "https://www.primevideo.com/")
        .header("content-type", "application/json")
        .json(&body);
    if let Some(cookie) = secrets::get(app, COOKIE_ACCOUNT)?.filter(|item| !item.is_empty()) {
        builder = builder.header("cookie", cookie);
    }
    let response = builder
        .send()
        .await
        .map_err(|error| format!("licença do prime recusada: recebido {error}, esperado HTTP"))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|error| format!("licença do prime recusada: recebido {error}, esperado corpo"))?;
    if !status.is_success() {
        return Err(format!(
            "licença do prime recusada: recebido HTTP {status} {}, esperado 2xx",
            snippet(&text)
        ));
    }
    license_from_response(&text)
}

#[cfg(test)]
mod tests {
    use super::{allowed_license_url, license_from_response};

    #[test]
    fn allowlist_so_drm_fairplay_do_atv_ps() {
        assert!(allowed_license_url(
            "https://atv-ps.primevideo.com/playback/drm-vod/GetFairPlayLicense?deviceID=Web"
        ));
        assert!(allowed_license_url(
            "https://atv-ps.primevideo.com/playback/drm-live/GetFairPlayLicense?titleId=x"
        ));
        assert!(allowed_license_url(
            "https://atv-ps.primevideo.com/playback/drm-linear/GetFairPlayLicense?titleId=x"
        ));
        assert!(!allowed_license_url(
            "https://atv-ps.primevideo.com/playback/drm-vod/GetWidevineLicense"
        ));
        assert!(!allowed_license_url(
            "http://atv-ps.primevideo.com/playback/drm-vod/GetFairPlayLicense"
        ));
        assert!(!allowed_license_url(
            "https://atv-ps.primevideo.com.evil.net/playback/drm-vod/GetFairPlayLicense"
        ));
        assert!(!allowed_license_url(
            "https://www.primevideo.com/playback/drm-vod/GetFairPlayLicense"
        ));
    }

    #[test]
    fn license_from_response_extrai_o_ckc() {
        let ckc =
            license_from_response(r#"{"fairPlayLicense":{"license":"AAAAAQ"}}"#).expect("ckc");
        assert_eq!(ckc, "AAAAAQ");
    }

    #[test]
    fn license_from_response_recusa_sem_campo() {
        assert!(license_from_response(r#"{"erro":"sem licenca"}"#)
            .unwrap_err()
            .contains("esperado fairPlayLicense.license"));
        assert!(license_from_response("não é json")
            .unwrap_err()
            .contains("esperado JSON"));
    }
}
