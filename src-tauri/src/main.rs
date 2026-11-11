#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_paths;
mod db;
mod player;
mod prime_api;
mod prime_drm;
mod prime_oracle;
mod prime_pane;
mod prime_session;
mod prime_spike;
mod prime_window;
mod secrets;
mod seed;
mod youtube_api;
mod youtube_bind;
mod youtube_media;
mod youtube_nsig;
mod youtube_proxy;
mod youtube_window;

use tauri::AppHandle;

/// Abre a URL no player externo.
#[tauri::command]
fn play_sidecar(url: String) -> Result<(), String> {
    player::play(&url)
}

/// Captura do oráculo vinda do hook injetado no pane oficial (IPC, imune a CSP).
#[tauri::command]
fn prime_oracle_report(app: AppHandle, payload: String) -> Result<(), String> {
    prime_oracle::ingest(&app, payload.as_bytes());
    Ok(())
}

/// Proxy allowlist do BFF Prime Video (enrichNav / getLandingPage).
#[tauri::command]
async fn prime_request(
    app: AppHandle,
    method: String,
    path: String,
    body: Option<String>,
) -> Result<String, String> {
    prime_api::request(&app, &method, &path, body.as_deref()).await
}

/// Licença FairPlay oficial: SPC do nosso CDM + envelope/handoff do oráculo.
#[tauri::command]
async fn prime_license(
    app: AppHandle,
    url: String,
    envelope: String,
    handoff: String,
    challenge: String,
) -> Result<String, String> {
    prime_drm::license(&app, &url, &envelope, &handoff, &challenge).await
}

/// Cunha uma sessão de playback própria repetindo o PRS oficial do oráculo.
#[tauri::command]
async fn prime_session_mint(app: AppHandle, url: String, body: String) -> Result<String, String> {
    prime_session::mint(&app, &url, &body).await
}

/// Abre a janela oficial do Prime Video para o login da conta Amazon.
#[tauri::command]
async fn prime_sign_in(app: AppHandle) -> Result<(), String> {
    prime_window::sign_in(&app)
}

/// Abre o detalhe do título na janela oficial (o player roda no site da Amazon).
#[tauri::command]
async fn prime_open_player(app: AppHandle, url: String) -> Result<(), String> {
    prime_window::open_player(&app, &url)
}

/// Abre o mesmo título no navegador padrão do sistema.
#[tauri::command]
async fn prime_open_external(url: String) -> Result<(), String> {
    prime_window::open_external(&url)
}

/// Abre o título no painel embutido: webview filho da janela principal, sobre o retângulo
/// que a UI reservou. Async porque `add_child` bloqueia esperando a main thread.
#[tauri::command]
async fn prime_pane_open(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    prime_pane::open(
        &app,
        &url,
        prime_pane::PaneRect {
            x,
            y,
            width,
            height,
        },
    )
}

/// Reposiciona o painel sobre o placeholder (redesenho, resize, rolagem).
#[tauri::command]
async fn prime_pane_place(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    prime_pane::place(
        &app,
        prime_pane::PaneRect {
            x,
            y,
            width,
            height,
        },
    )
}

/// Esconde o painel e devolve o foco para a UI, sem desfazer a sessão do player.
#[tauri::command]
async fn prime_pane_hide(app: AppHandle) -> Result<(), String> {
    prime_pane::focus_shell(&app)
}

/// Fecha o painel, para o player oficial e devolve o foco para a UI.
#[tauri::command]
async fn prime_pane_close(app: AppHandle) -> Result<(), String> {
    prime_pane::close(&app)?;
    prime_pane::focus_shell(&app)
}

/// Copia a sessão do webview oficial para o cofre e devolve o header Cookie.
#[tauri::command]
async fn prime_session_cookie(app: AppHandle) -> Result<String, String> {
    prime_window::session_cookie(&app)
}

/// Limpa o webview oficial e apaga o cookie do cofre.
#[tauri::command]
async fn prime_sign_out(app: AppHandle) -> Result<(), String> {
    prime_window::sign_out(&app)
}

/// Proxy allowlist do Innertube YouTube (browse/search/player/next/guide).
#[tauri::command]
async fn youtube_request(
    app: AppHandle,
    path: String,
    body: Option<String>,
) -> Result<String, String> {
    youtube_api::request(&app, &path, body.as_deref()).await
}

/// Abre a janela oficial do YouTube para o login da conta Google.
#[tauri::command]
async fn youtube_sign_in(app: AppHandle) -> Result<(), String> {
    youtube_window::sign_in(&app)
}

/// Lê o jar do webview (login ou janela principal) e grava SAPISID no cofre.
#[tauri::command]
async fn youtube_auth_check(app: AppHandle) -> Result<String, String> {
    youtube_window::auth_check(&app)
}

/// Copia a sessão do webview oficial para o cofre e devolve o header Cookie.
#[tauri::command]
async fn youtube_session_cookie(app: AppHandle) -> Result<String, String> {
    youtube_window::session_cookie(&app)
}

/// Limpa o webview oficial e apaga o cookie do cofre.
#[tauri::command]
async fn youtube_sign_out(app: AppHandle) -> Result<(), String> {
    youtube_window::sign_out(&app)
}

/// Base do proxy local de vídeo (`http://127.0.0.1:{port}`).
#[tauri::command]
fn youtube_proxy_base() -> Result<String, String> {
    youtube_proxy::base_url()
}

/// Grava a senha da playlist no cofre local 0600.
#[tauri::command]
fn secret_set(app: AppHandle, account: String, value: String) -> Result<(), String> {
    secrets::set(&app, &account, &value)
}

/// Lê a senha da playlist; ausência vira None.
#[tauri::command]
fn secret_get(app: AppHandle, account: String) -> Result<Option<String>, String> {
    secrets::get(&app, &account)
}

/// Lê o seed local de ajustes.
#[tauri::command]
fn seed_read(app: AppHandle) -> Result<Option<String>, String> {
    seed::read(&app)
}

/// Lê um valor JSON do sqlite local.
#[tauri::command]
fn db_get(app: AppHandle, key: String) -> Result<Option<String>, String> {
    db::get(&app, &key)
}

/// Grava um valor JSON no sqlite local.
#[tauri::command]
fn db_set(app: AppHandle, key: String, value: String) -> Result<(), String> {
    db::set(&app, &key, &value)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            youtube_proxy::start(app.handle().clone())
                .map(|_| ())
                .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;
            prime_oracle::start(app.handle().clone())
                .map(|_| ())
                .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;
            if std::env::var_os("OPENFLIX_PRIME_SPIKE").is_some() {
                prime_spike::run(app.handle().clone());
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            play_sidecar,
            prime_request,
            prime_oracle_report,
            prime_license,
            prime_session_mint,
            prime_sign_in,
            prime_open_player,
            prime_open_external,
            prime_pane_open,
            prime_pane_place,
            prime_pane_hide,
            prime_pane_close,
            prime_session_cookie,
            prime_sign_out,
            youtube_request,
            youtube_sign_in,
            youtube_auth_check,
            youtube_session_cookie,
            youtube_sign_out,
            youtube_proxy_base,
            secret_set,
            secret_get,
            seed_read,
            db_get,
            db_set
        ])
        .run(tauri::generate_context!())
        .expect("falha ao abrir a janela");
}
