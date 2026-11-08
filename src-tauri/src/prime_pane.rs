//! Painel embutido: o player oficial da Amazon roda num webview **filho** da janela
//! principal, posicionado por cima do retângulo que a UI do OpenFlix reserva pra ele.
//!
//! O webview filho é uma NSView nativa sobre a UI, não um elemento do DOM. A página da
//! Amazon resolve o próprio DRM dentro dela — o OpenFlix não toca em licença, chave,
//! envelope ou segmento; ele só decide onde o painel aparece e para onde navega.

use tauri::{
    AppHandle, LogicalPosition, LogicalSize, Manager, Url, Webview, WebviewBuilder, WebviewUrl,
    Window,
};

use crate::prime_window::{allowed_url, SAFARI_UA};

const MAIN_WINDOW: &str = "main";
const PANE_LABEL: &str = "prime-pane";
/// Abaixo disso o player oficial não desenha controle nenhum: melhor esconder o painel.
pub const MIN_WIDTH: f64 = 320.0;
pub const MIN_HEIGHT: f64 = 180.0;

/// Retângulo lógico (px de CSS) do painel dentro da janela principal.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PaneRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

fn is_finite(rect: &PaneRect) -> bool {
    [rect.x, rect.y, rect.width, rect.height]
        .iter()
        .all(|value| value.is_finite())
}

/// Recorta o painel para caber na janela. `None` quando o que sobra é pequeno demais ou
/// quando veio medida não finita — placeholder oculto devolve tudo zero no DOM.
pub fn clamp_rect(rect: PaneRect, window_width: f64, window_height: f64) -> Option<PaneRect> {
    if !is_finite(&rect) || window_width <= 0.0 || window_height <= 0.0 {
        return None;
    }
    let left = rect.x.clamp(0.0, window_width);
    let top = rect.y.clamp(0.0, window_height);
    let width = (rect.x + rect.width).clamp(0.0, window_width) - left;
    let height = (rect.y + rect.height).clamp(0.0, window_height) - top;
    if width < MIN_WIDTH || height < MIN_HEIGHT {
        return None;
    }
    Some(PaneRect {
        x: left,
        y: top,
        width,
        height,
    })
}

fn pane_error(step: &str, error: impl std::fmt::Display) -> String {
    format!("painel do prime recusado em {step}: recebido {error}, esperado webview filho")
}

fn main_window(app: &AppHandle) -> Result<Window, String> {
    app.get_window(MAIN_WINDOW).ok_or_else(|| {
        format!(
            "painel do prime recusado: recebido janela sem rótulo {MAIN_WINDOW}, esperado janela principal"
        )
    })
}

/// Tamanho da janela em px lógico — o DOM mede em CSS px, o webview filho também.
fn logical_window_size(app: &AppHandle) -> Result<(f64, f64), String> {
    let window = main_window(app)?;
    let scale = window
        .scale_factor()
        .map_err(|error| pane_error("scale_factor", error))?;
    let size = window
        .inner_size()
        .map_err(|error| pane_error("inner_size", error))?;
    Ok((
        f64::from(size.width) / scale,
        f64::from(size.height) / scale,
    ))
}

fn existing_pane(app: &AppHandle) -> Option<Webview> {
    app.get_webview(PANE_LABEL)
}

fn place_webview(webview: &Webview, rect: PaneRect) -> Result<(), String> {
    webview
        .set_position(LogicalPosition::new(rect.x, rect.y))
        .map_err(|error| pane_error("set_position", error))?;
    webview
        .set_size(LogicalSize::new(rect.width, rect.height))
        .map_err(|error| pane_error("set_size", error))
}

fn fitted_rect(app: &AppHandle, rect: PaneRect) -> Result<PaneRect, String> {
    let (window_width, window_height) = logical_window_size(app)?;
    clamp_rect(rect, window_width, window_height).ok_or_else(|| {
        format!(
            "painel do prime recusado: recebido retângulo {}x{} numa janela {}x{}, esperado área visível de ao menos {MIN_WIDTH}x{MIN_HEIGHT}",
            rect.width, rect.height, window_width, window_height
        )
    })
}

/// Cria (ou reusa) o painel e navega para o título. O player oficial toca dentro da janela.
pub fn open(app: &AppHandle, url: &str, rect: PaneRect) -> Result<(), String> {
    if !allowed_url(url) {
        return Err(format!(
            "painel do prime recusado: recebido {url}, esperado https://www.primevideo.com/..."
        ));
    }
    let target = Url::parse(url).map_err(|error| pane_error("Url::parse", error))?;
    let placed = fitted_rect(app, rect)?;
    if let Some(webview) = existing_pane(app) {
        webview
            .navigate(target)
            .map_err(|error| pane_error("navigate", error))?;
        place_webview(&webview, placed)?;
        webview.show().map_err(|error| pane_error("show", error))?;
        return webview
            .set_focus()
            .map_err(|error| pane_error("set_focus", error));
    }
    let webview = main_window(app)?
        .add_child(
            WebviewBuilder::new(PANE_LABEL, WebviewUrl::External(target)).user_agent(SAFARI_UA),
            LogicalPosition::new(placed.x, placed.y),
            LogicalSize::new(placed.width, placed.height),
        )
        .map_err(|error| pane_error("add_child", error))?;
    webview
        .set_focus()
        .map_err(|error| pane_error("set_focus", error))
}

/// Reposiciona o painel sobre o placeholder. Sem painel criado é um não-evento: a UI chama
/// isto a cada redesenho e redimensionamento, inclusive com o player fechado. Retângulo que
/// não cabe mais (rolou para fora, aba trocou) esconde o painel em vez de deixá-lo torto.
pub fn place(app: &AppHandle, rect: PaneRect) -> Result<(), String> {
    let Some(webview) = existing_pane(app) else {
        return Ok(());
    };
    let (window_width, window_height) = logical_window_size(app)?;
    let Some(placed) = clamp_rect(rect, window_width, window_height) else {
        return webview.hide().map_err(|error| pane_error("hide", error));
    };
    place_webview(&webview, placed)?;
    webview.show().map_err(|error| pane_error("show", error))
}

/// Esconde o painel sem destruir a sessão — trocar de aba não deve desfazer o login.
pub fn hide(app: &AppHandle) -> Result<(), String> {
    let Some(webview) = existing_pane(app) else {
        return Ok(());
    };
    webview.hide().map_err(|error| pane_error("hide", error))
}

/// Devolve o foco para a UI do OpenFlix e mantém o painel escondido.
pub fn focus_shell(app: &AppHandle) -> Result<(), String> {
    hide(app)?;
    let Some(webview) = app.get_webview(MAIN_WINDOW) else {
        return Ok(());
    };
    webview
        .set_focus()
        .map_err(|error| pane_error("focus da UI", error))
}

/// Fecha o painel e para o player oficial.
pub fn close(app: &AppHandle) -> Result<(), String> {
    let Some(webview) = existing_pane(app) else {
        return Ok(());
    };
    webview.close().map_err(|error| pane_error("close", error))
}

#[cfg(test)]
mod tests {
    use super::{clamp_rect, PaneRect, MIN_HEIGHT, MIN_WIDTH};

    fn rect(x: f64, y: f64, width: f64, height: f64) -> PaneRect {
        PaneRect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn retangulo_dentro_da_janela_passa_inteiro() {
        let placed = clamp_rect(rect(240.0, 80.0, 960.0, 540.0), 1600.0, 900.0).unwrap();
        assert_eq!(placed, rect(240.0, 80.0, 960.0, 540.0));
    }

    #[test]
    fn retangulo_que_transborda_e_recortado_para_a_borda() {
        let placed = clamp_rect(rect(1000.0, 400.0, 960.0, 540.0), 1600.0, 900.0).unwrap();
        assert_eq!(placed, rect(1000.0, 400.0, 600.0, 500.0));
    }

    #[test]
    fn coordenada_negativa_e_recortada_para_a_borda() {
        let placed = clamp_rect(rect(-100.0, -50.0, 960.0, 540.0), 1600.0, 900.0).unwrap();
        assert_eq!(placed, rect(0.0, 0.0, 860.0, 490.0));
    }

    #[test]
    fn sobra_pequena_demais_vira_none() {
        // Sobram 200px de largura na janela, abaixo do mínimo do player oficial.
        assert_eq!(
            clamp_rect(rect(1400.0, 0.0, 960.0, 540.0), 1600.0, 900.0),
            None
        );
        assert_eq!(
            clamp_rect(rect(0.0, 0.0, MIN_WIDTH - 1.0, MIN_HEIGHT), 1600.0, 900.0),
            None
        );
        assert_eq!(
            clamp_rect(rect(0.0, 0.0, MIN_WIDTH, MIN_HEIGHT), 1600.0, 900.0),
            Some(rect(0.0, 0.0, MIN_WIDTH, MIN_HEIGHT))
        );
    }

    #[test]
    fn medida_nao_finita_ou_janela_invalida_vira_none() {
        assert_eq!(
            clamp_rect(rect(f64::NAN, 0.0, 960.0, 540.0), 1600.0, 900.0),
            None
        );
        assert_eq!(
            clamp_rect(rect(0.0, 0.0, f64::INFINITY, 540.0), 1600.0, 900.0),
            None
        );
        // Placeholder oculto: getBoundingClientRect devolve tudo zero.
        assert_eq!(clamp_rect(rect(0.0, 0.0, 0.0, 0.0), 1600.0, 900.0), None);
        assert_eq!(clamp_rect(rect(0.0, 0.0, 960.0, 540.0), 0.0, 900.0), None);
    }
}
