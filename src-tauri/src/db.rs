use std::path::Path;

use crate::app_paths::data_file;

const DB_FILE: &str = "life-tv.sqlite";

/// Lê o valor bruto da chave no sqlite do app.
pub fn get(app: &tauri::AppHandle, key: &str) -> Result<Option<String>, String> {
    get_at(&data_file(app, DB_FILE)?, key)
}

/// Grava o valor bruto da chave no sqlite do app.
pub fn set(app: &tauri::AppHandle, key: &str, value: &str) -> Result<(), String> {
    set_at(&data_file(app, DB_FILE)?, key, value)
}

fn sqlite_err(error: impl std::fmt::Display) -> String {
    format!("sqlite recusado: {error}")
}

fn require_key(key: &str) -> Result<(), String> {
    let ok = !key.is_empty()
        && key
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, ':' | '_' | '-'));
    if ok {
        return Ok(());
    }
    Err(format!(
        "sqlite recusado: recebida chave {key:?}, esperada chave [a-z0-9:_-]"
    ))
}

fn protect_file(path: &Path) -> Result<(), String> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(sqlite_err)?;
    }
    #[cfg(not(unix))]
    let _ = path;
    Ok(())
}

fn open(path: &Path) -> Result<rusqlite::Connection, String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(sqlite_err)?;
    }
    let conn = rusqlite::Connection::open(path).map_err(sqlite_err)?;
    protect_file(path)?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )
    .map_err(sqlite_err)?;
    Ok(conn)
}

pub fn get_at(path: &Path, key: &str) -> Result<Option<String>, String> {
    require_key(key)?;
    let conn = open(path)?;
    let mut stmt = conn
        .prepare("SELECT value FROM kv WHERE key = ?1")
        .map_err(sqlite_err)?;
    let mut rows = stmt.query(rusqlite::params![key]).map_err(sqlite_err)?;
    match rows.next().map_err(sqlite_err)? {
        Some(row) => row.get(0).map(Some).map_err(sqlite_err),
        None => Ok(None),
    }
}

pub fn set_at(path: &Path, key: &str, value: &str) -> Result<(), String> {
    require_key(key)?;
    let conn = open(path)?;
    conn.execute(
        "INSERT INTO kv (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key, value],
    )
    .map_err(sqlite_err)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    static SEQ: AtomicU64 = AtomicU64::new(0);

    fn temp_path() -> std::path::PathBuf {
        let n = SEQ.fetch_add(1, Ordering::Relaxed);
        std::env::temp_dir().join(format!("life-tv-kv-{}-{n}.sqlite", std::process::id()))
    }

    fn cleanup(path: &Path) {
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn roundtrip_json_value() {
        let path = temp_path();
        set_at(&path, "life-tv:playlists", "[{\"id\":\"pl-1\"}]").unwrap();
        let got = get_at(&path, "life-tv:playlists").unwrap();
        assert_eq!(got.as_deref(), Some("[{\"id\":\"pl-1\"}]"));
        cleanup(&path);
    }

    #[test]
    fn missing_key_is_none() {
        let path = temp_path();
        assert_eq!(get_at(&path, "life-tv:playlists").unwrap(), None);
        cleanup(&path);
    }

    #[test]
    fn overwrite_replaces_value() {
        let path = temp_path();
        set_at(&path, "life-tv:resume", "um").unwrap();
        set_at(&path, "life-tv:resume", "dois").unwrap();
        assert_eq!(
            get_at(&path, "life-tv:resume").unwrap().as_deref(),
            Some("dois")
        );
        cleanup(&path);
    }

    #[test]
    fn rejects_invalid_key() {
        let path = temp_path();
        let err = set_at(&path, "chave inválida", "x").unwrap_err();
        assert!(err.contains("sqlite recusado"), "{err}");
        cleanup(&path);
    }

    #[cfg(unix)]
    #[test]
    fn sqlite_file_is_private() {
        use std::os::unix::fs::PermissionsExt;
        let path = temp_path();
        set_at(&path, "life-tv:favs", "{}").unwrap();
        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
        cleanup(&path);
    }
}
