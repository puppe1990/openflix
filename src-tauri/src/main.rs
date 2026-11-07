#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_paths;
mod db;
mod player;
mod prime_api;
mod secrets;
mod seed;

use tauri::AppHandle;

/// Abre a URL no player externo.
#[tauri::command]
fn play_sidecar(url: String) -> Result<(), String> {
    player::play(&url)
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
        .invoke_handler(tauri::generate_handler![
            play_sidecar,
            prime_request,
            secret_set,
            secret_get,
            seed_read,
            db_get,
            db_set
        ])
        .run(tauri::generate_context!())
        .expect("falha ao abrir a janela");
}
