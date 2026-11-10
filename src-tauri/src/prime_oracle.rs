//! Oráculo do Prime: servidor local que recebe as capturas do hook injetado no
//! pane oficial. O player da Amazon continua tocando como hoje; o hook observa
//! as chamadas de playback (PRS/PES/DRM) e reporta aqui. O OpenFlix usa o
//! `playbackEnvelope` e o `sessionHandoffToken` mintados pelo JS oficial da
//! Amazon para repetir as mesmas chamadas oficiais e tocar o título no player
//! nativo — nada de clonar DRM.

use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::OnceLock;
use std::thread;

use tauri::{AppHandle, Emitter};

use crate::app_paths;

const CAPTURE_PATH: &str = "/oracle";
const LOG_FILE: &str = "prime-oracle.jsonl";
/// Corte de segurança: captura maior que isso é página fazendo coisa errada.
const MAX_CAPTURE: usize = 4_194_304;
/// Log que passa disso recomeça do zero: captura é diagnóstico, não histórico.
const MAX_LOG_BYTES: u64 = 8 * 1024 * 1024;

static ORACLE_BASE: OnceLock<String> = OnceLock::new();

const HOOK_TEMPLATE: &str = include_str!("prime_oracle_hook.js");

/// Base `http://127.0.0.1:{port}` depois do `start`.
pub fn base_url() -> Result<String, String> {
    ORACLE_BASE.get().cloned().ok_or_else(|| {
        "oráculo do prime recusou: recebido servidor parado, esperado start no setup do app"
            .to_string()
    })
}

/// Script do oráculo com a base da captura já resolvida.
pub fn hook_script() -> Result<String, String> {
    Ok(HOOK_TEMPLATE.replace("__CAPTURE_BASE__", &base_url()?))
}

/// Script pronto para injetar; servidor parado vira script vazio no log do erro.
pub fn hook_script_or_empty() -> String {
    match hook_script() {
        Ok(script) => script,
        Err(error) => {
            eprintln!("oráculo do prime sem script ({error})");
            String::new()
        }
    }
}

/// Sobe o servidor de captura do oráculo em 127.0.0.1:0.
pub fn start(app: AppHandle) -> Result<String, String> {
    if let Some(base) = ORACLE_BASE.get() {
        return Ok(base.clone());
    }
    let listener = TcpListener::bind("127.0.0.1:0").map_err(|error| {
        format!("oráculo do prime recusou: recebido {error}, esperado bind em 127.0.0.1")
    })?;
    let port = listener
        .local_addr()
        .map_err(|error| {
            format!("oráculo do prime recusou: recebido {error}, esperado porta local")
        })?
        .port();
    let base = format!("http://127.0.0.1:{port}");
    let _ = ORACLE_BASE.set(base.clone());
    thread::spawn(move || {
        for connection in listener.incoming().flatten() {
            let app = app.clone();
            thread::spawn(move || {
                let _ = serve(connection, app);
            });
        }
    });
    Ok(base)
}

/// `POST /oracle` com corpo JSON vindo do hook; qualquer outra coisa é silêncio.
fn is_capture_request(request_line: &str) -> bool {
    let mut parts = request_line.split_whitespace();
    parts.next() == Some("POST") && parts.next() == Some(CAPTURE_PATH)
}

fn content_length(head: &str) -> usize {
    for line in head.lines() {
        let Some((name, value)) = line.split_once(':') else {
            continue;
        };
        if name.trim().eq_ignore_ascii_case("content-length") {
            return value.trim().parse().unwrap_or(0);
        }
    }
    0
}

fn find_head_end(got: &[u8]) -> Option<usize> {
    got.windows(4)
        .position(|window| window == b"\r\n\r\n")
        .map(|pos| pos + 4)
}

fn read_request(stream: &mut TcpStream) -> io::Result<(String, Vec<u8>)> {
    let mut chunk = [0_u8; 8192];
    let mut got = Vec::new();
    let head_end = loop {
        let n = stream.read(&mut chunk)?;
        if n == 0 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "oráculo do prime recusou: recebida conexão sem cabeçalho",
            ));
        }
        got.extend_from_slice(&chunk[..n]);
        if let Some(end) = find_head_end(&got) {
            break end;
        }
        if got.len() >= MAX_CAPTURE {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "oráculo do prime recusou: recebido cabeçalho gigante, esperado HTTP curto",
            ));
        }
    };
    let head = String::from_utf8_lossy(&got[..head_end]).into_owned();
    let length = content_length(&head).min(MAX_CAPTURE);
    let mut body = got[head_end.min(got.len())..].to_vec();
    while body.len() < length {
        let n = stream.read(&mut chunk)?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..n]);
    }
    body.truncate(length);
    Ok((head, body))
}

fn write_preflight(stream: &mut TcpStream) -> io::Result<()> {
    stream.write_all(
        b"HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nConnection: close\r\n\r\n",
    )
}

fn write_status(stream: &mut TcpStream, status: u16, reason: &str) -> io::Result<()> {
    stream.write_all(
        format!("HTTP/1.1 {status} {reason}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n").as_bytes(),
    )
}

/// Cada captura chega como um JSON de linha; vai para a UI (evento) e para o
/// log em disco, que alimenta o diagnóstico do player nativo. Vale tanto pelo
/// IPC do hook (pane não sofre CSP) quanto pelo servidor local de smoke.
pub fn ingest(app: &AppHandle, body: &[u8]) {
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(body) else {
        eprintln!("oráculo do prime: captura ilegível fora do JSON");
        return;
    };
    let _ = app.emit("prime-oracle", &value);
    if let Err(error) = append_log(app, &value) {
        eprintln!("oráculo do prime: log recusado ({error})");
    }
}

fn append_log(app: &AppHandle, value: &serde_json::Value) -> Result<(), String> {
    let path = app_paths::data_file(app, LOG_FILE)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| format!("{error}"))?;
    }
    if std::fs::metadata(&path)
        .map(|meta| meta.len() > MAX_LOG_BYTES)
        .unwrap_or(false)
    {
        std::fs::remove_file(&path).map_err(|error| format!("{error}"))?;
    }
    let line = serde_json::to_string(value).map_err(|error| format!("{error}"))?;
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("{error}"))?;
    writeln!(file, "{line}").map_err(|error| format!("{error}"))
}

fn serve(mut stream: TcpStream, app: AppHandle) -> io::Result<()> {
    let (head, body) = read_request(&mut stream)?;
    let request_line = head.lines().next().unwrap_or_default();
    if request_line.starts_with("OPTIONS ") {
        return write_preflight(&mut stream);
    }
    if !is_capture_request(request_line) {
        let status = if request_line.starts_with("POST ") {
            404
        } else {
            405
        };
        let reason = if status == 404 {
            "Not Found"
        } else {
            "Method Not Allowed"
        };
        return write_status(&mut stream, status, reason);
    }
    ingest(&app, &body);
    write_status(&mut stream, 204, "No Content")
}

#[cfg(test)]
mod tests {
    use super::{content_length, find_head_end, is_capture_request};

    #[test]
    fn so_post_oracle_e_capturado() {
        assert!(is_capture_request("POST /oracle HTTP/1.1"));
        assert!(!is_capture_request("GET /oracle HTTP/1.1"));
        assert!(!is_capture_request("POST /video/abc.mp4 HTTP/1.1"));
        assert!(!is_capture_request("OPTIONS /oracle HTTP/1.1"));
        assert!(!is_capture_request(""));
    }

    #[test]
    fn content_length_caso_insensivel() {
        let head = "POST /oracle HTTP/1.1\r\nContent-Length: 42\r\n\r\n";
        assert_eq!(content_length(head), 42);
        let other = "POST /oracle HTTP/1.1\r\ncontent-length: 7\r\n\r\n";
        assert_eq!(content_length(other), 7);
        assert_eq!(content_length("POST /oracle HTTP/1.1\r\n\r\n"), 0);
    }

    #[test]
    fn content_length_ignora_host_com_porta() {
        // Host vem antes e tem dois-pontos: só a linha content-length vale.
        let head = "POST /oracle HTTP/1.1\r\nHost: 127.0.0.1:49970\r\nContent-Length: 27\r\n\r\n";
        assert_eq!(content_length(head), 27);
    }

    #[test]
    fn head_end_para_no_primeiro_crlf_crlf() {
        let got = b"POST /oracle HTTP/1.1\r\nContent-Length: 2\r\n\r\n{}";
        assert_eq!(
            find_head_end(got),
            Some(b"POST /oracle HTTP/1.1\r\nContent-Length: 2\r\n\r\n".len())
        );
        assert_eq!(find_head_end(b"sem fim"), None);
    }
}
