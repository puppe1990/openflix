use std::collections::BTreeMap;
use std::io::Write;

use crate::app_paths::data_file;

const SECRETS_FILE: &str = "secrets.json";

fn read_map(app: &tauri::AppHandle) -> Result<BTreeMap<String, String>, String> {
    let path = data_file(app, SECRETS_FILE)?;
    match std::fs::read_to_string(&path) {
        Ok(text) => {
            serde_json::from_str(&text).map_err(|error| format!("secret recusado: {error}"))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(BTreeMap::new()),
        Err(error) => Err(format!("secret recusado: {error}")),
    }
}

fn write_map(app: &tauri::AppHandle, secrets: &BTreeMap<String, String>) -> Result<(), String> {
    let path = data_file(app, SECRETS_FILE)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("secret recusado: {error}"))?;
    }
    let body = serde_json::to_string_pretty(secrets)
        .map_err(|error| format!("secret recusado: {error}"))?;
    let mut opts = std::fs::OpenOptions::new();
    opts.create(true).write(true).truncate(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        opts.mode(0o600);
    }
    let mut file = opts
        .open(&path)
        .map_err(|error| format!("secret recusado: {error}"))?;
    file.write_all(body.as_bytes())
        .map_err(|error| format!("secret recusado: {error}"))
}

pub fn get(app: &tauri::AppHandle, account: &str) -> Result<Option<String>, String> {
    Ok(read_map(app)?.get(account).cloned())
}

pub fn set(app: &tauri::AppHandle, account: &str, value: &str) -> Result<(), String> {
    let mut secrets = read_map(app)?;
    secrets.insert(account.to_string(), value.to_string());
    write_map(app, &secrets)
}

pub fn remove(app: &tauri::AppHandle, account: &str) -> Result<(), String> {
    let mut secrets = read_map(app)?;
    if secrets.remove(account).is_some() {
        write_map(app, &secrets)?;
    }
    Ok(())
}
