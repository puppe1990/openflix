// Oráculo do Prime — injetado no pane oficial antes da página da Amazon carregar.
// Observa as chamadas de playback (PRS/PES/DRM) que o player oficial faz e
// reporta num servidor local do OpenFlix. Não bloqueia nem altera nada: só
// escuta. `__CAPTURE_BASE__` é resolvido pelo Rust na criação do webview.
;(() => {
  if (window.__openflixOracle) return
  window.__openflixOracle = true

  const CAPTURE_BASE = '__CAPTURE_BASE__'

  // Só o que interessa ao player nativo: PRS (envelope + MPD), PES (sessão),
  // catálogo de playback e licença. Telemetria de página fica de fora.
  function captureWorthy(rawUrl) {
    try {
      const url = new URL(rawUrl, location.href)
      const path = url.pathname
      const target = `${url.hostname}${path}`
      if (/license|fairplay|drm-|widevine/i.test(target)) return true
      if (url.hostname !== 'atv-ps.primevideo.com') return false
      return (
        path.startsWith('/playback/') ||
        path.startsWith('/cdp/playback/') ||
        path.startsWith('/cdp/catalog/') ||
        path.startsWith('/cdp/usage/GetAppStartupConfig') ||
        path.startsWith('/acm/GetConfiguration/WebClient')
      )
    } catch {
      return false
    }
  }

  function bytesBase64(bytes) {
    let binary = ''
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
    }
    return btoa(binary)
  }

  // Corpo legível sem consumir o original (Blob/ArrayBuffer são imutáveis;
  // ReadableStream não dá para ler sem consumir, aí vira null).
  async function bodyText(body) {
    if (body == null) return null
    try {
      if (typeof body === 'string') return body
      if (body instanceof URLSearchParams) return body.toString()
      if (body instanceof Uint8Array) return bytesBase64(body)
      if (body instanceof ArrayBuffer) return bytesBase64(new Uint8Array(body))
      if (body instanceof Blob) return await body.text()
    } catch {
      // Corpo opaco: o oráculo segue sem o texto, nunca derruba o fetch original.
    }
    return null
  }

  // O PRS real passa de 500 KB (urlSets + xray + trickplay). Cortar em 200 KB
  // invalida o JSON e o player nativo perde a captura inteira.
  function clip(text) {
    if (text == null) return null
    return text.length > 4000000 ? `${text.slice(0, 4000000)}…` : text
  }

  async function report(kind, payload) {
    const data = JSON.stringify({ kind, at: Date.now(), ...payload })
    const invoke = window.__TAURI_INTERNALS__ && window.__TAURI_INTERNALS__.invoke
    if (typeof invoke === 'function') {
      try {
        await invoke('prime_oracle_report', { payload: data })
        return
      } catch {
        // IPC indisponível: cai no servidor HTTP local do oráculo.
      }
    }
    try {
      await fetch(`${CAPTURE_BASE}/oracle`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: data,
      })
    } catch {
      // Captura é diagnóstico: sem servidor, o player oficial segue intacto.
    }
  }

  const nativeFetch = window.fetch
  if (typeof nativeFetch === 'function') {
    window.fetch = async function (input, init) {
      const url =
        typeof input === 'string' ? input : input && typeof input.url === 'string' ? input.url : ''
      let requestBody = null
      if (captureWorthy(url) && init && init.body != null) {
        requestBody = await bodyText(init.body)
      }
      const response = await nativeFetch.apply(this, arguments)
      if (captureWorthy(url)) {
        const method = (init && init.method) || (input && input.method) || 'GET'
        response
          .clone()
          .text()
          .then((responseBody) =>
            report('fetch', {
              url,
              method,
              body: requestBody,
              status: response.status,
              response: clip(responseBody),
            }),
          )
          .catch(() => {})
      }
      return response
    }
  }

  const openNative = XMLHttpRequest.prototype.open
  const sendNative = XMLHttpRequest.prototype.send
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__openflixMeta = { method: String(method || 'GET'), url: String(url || '') }
    return openNative.apply(this, arguments)
  }
  XMLHttpRequest.prototype.send = function (body) {
    const meta = this.__openflixMeta
    if (meta && captureWorthy(meta.url)) {
      const xhr = this
      xhr.addEventListener('load', () => {
        let responseBody = null
        try {
          responseBody = xhr.responseText
        } catch {
          // responseType binário não expõe texto; a captura fica sem corpo.
        }
        bodyText(body).then((requestBody) =>
          report('xhr', {
            url: meta.url,
            method: meta.method,
            body: requestBody,
            status: xhr.status,
            response: clip(responseBody),
          }),
        )
      })
    }
    return sendNative.apply(this, arguments)
  }

  // Confirma o key system que a página pede (widevine vs fairplay) e que o
  // oráculo está vivo a cada navegação do pane.
  // O oráculo precisa que o player oficial comece sozinho — é só dele que sai
  // o envelope; o OpenFlix fecha o pane assim que o PRS for capturado. O CTA
  // do título é um botão grande com texto "Play"/"Assistir"; o controlezinho
  // do trailer do herói é pequeno e fica de fora pelo tamanho.
  function labelOf(node) {
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
    const aria = (node.getAttribute('aria-label') || '').trim().toLowerCase()
    return text || aria
  }

  function isBigEnough(node) {
    const rect = node.getBoundingClientRect ? node.getBoundingClientRect() : null
    return Boolean(rect && rect.width >= 120 && rect.height >= 32)
  }

  // O CTA de verdade é `dp-atf-play-button` (texto "PlayResume" — por isso o
  // match é por prefixo, não por igualdade). O trailer do herói autoplaya e
  // também dispara PRS de 149s; nunca clicar nele, senão o spike "toca" o
  // trailer em vez do filme.
  function videoState() {
    return [...document.querySelectorAll('video')].map((video) => ({
      paused: video.paused,
      muted: video.muted,
      at: Math.round(video.currentTime),
      src: String(video.currentSrc || '').slice(0, 60),
    }))
  }

  function clickPlay() {
    // Só o CTA externo: o botão tem um `-spinner` interno com aria "Play" que
    // casava pelo label e era clicado antes do React liberar o botão de verdade.
    const node = document.querySelector('[data-testid="dp-atf-play-button"]')
    if (!node || node.__openflixClicked || !isBigEnough(node)) return false
    if (node.querySelector('[data-testid="dp-atf-play-button-spinner"]')) return false
    if (node.disabled || node.getAttribute('aria-disabled') === 'true') return false
    const testid = node.getAttribute('data-testid') || ''
    const label = labelOf(node)
    if (/trailer/i.test(`${testid} ${label}`)) return false
    node.__openflixClicked = true
    report('click', { testid, label: label.slice(0, 60), tag: node.tagName })
    node.click()
    setTimeout(() => report('after-click', { videos: videoState() }), 2500)
    return true
  }

  // Diagnóstico do spike: só os candidatos a CTA de reprodução da página.
  function reportDom() {
    const nodes = document.querySelectorAll('button, a, [role="button"], [data-testid]')
    const items = []
    for (const node of nodes) {
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
      const aria = (node.getAttribute('aria-label') || '').trim()
      const testid = node.getAttribute('data-testid') || ''
      const hay = `${text} ${aria} ${testid}`
      if (!/play|assistir|watch now|reproduzir/i.test(hay)) continue
      const rect = node.getBoundingClientRect
        ? node.getBoundingClientRect()
        : { width: 0, height: 0 }
      items.push({
        tag: node.tagName,
        text: text.slice(0, 40),
        aria: aria.slice(0, 40),
        testid: testid.slice(0, 60),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      })
    }
    report('dom', { url: location.href, items })
  }

  let playAttempts = 0
  const playTimer = setInterval(() => {
    playAttempts += 1
    if (clickPlay() || playAttempts > 40) clearInterval(playTimer)
  }, 1500)

  setTimeout(reportDom, 3000)

  if (navigator.requestMediaKeySystemAccess) {
    const nativeRequest = navigator.requestMediaKeySystemAccess.bind(navigator)
    navigator.requestMediaKeySystemAccess = function (keySystem, configs) {
      report('eme', { keySystem: String(keySystem), configCount: (configs || []).length })
      return nativeRequest(keySystem, configs)
    }
  }

  window.addEventListener('load', () => {
    report('page', { url: location.href, title: document.title })
  })
})()
