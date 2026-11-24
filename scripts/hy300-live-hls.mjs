#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { parseVodSrc, rewriteHlsToAbsolute } from '../src/hy300VodHls.mjs'
import { ffmpegLiveHlsArgs } from '../src/liveHlsWindow.mjs'

const HOST = process.env.HY300_LIVE_HOST || '192.168.15.3'
const PORT = Number(process.env.HY300_LIVE_PORT || 8794)
const SRC_FILE = process.env.HY300_LIVE_SRC || '/tmp/hy300-live-src.url'
const ROOT = process.env.HY300_LIVE_DIR || '/tmp/openflix-live-hls'
let job = null

function originOf(req) {
  return `http://${req.headers.host || `${HOST}:${PORT}`}`
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.from(body)
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Length': payload.length,
    ...headers,
  })
  res.end(payload)
}

function srcFromFile() {
  try {
    return readFileSync(SRC_FILE, 'utf8').trim()
  } catch {
    return ''
  }
}

function playlistSrc(req) {
  const href = `http://${req.headers.host || `${HOST}:${PORT}`}${req.url}`
  try {
    return parseVodSrc(href)
  } catch {
    const fromFile = srcFromFile()
    if (!fromFile) throw new Error('src ausente')
    return fromFile
  }
}

function ensureJob(src) {
  if (job && job.src === src && job.proc.exitCode == null) return job
  if (job && job.proc.exitCode == null) job.proc.kill('SIGTERM')
  mkdirSync(ROOT, { recursive: true })
  rmSync(ROOT, { recursive: true, force: true })
  mkdirSync(ROOT, { recursive: true })
  const ffmpeg = process.env.HY300_FFMPEG || 'ffmpeg'
  const proc = spawn(ffmpeg, ffmpegLiveHlsArgs({ src, dir: ROOT }), {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  proc.stderr.on('data', () => {})
  proc.on('exit', (code) => {
    if (code && code !== 0) console.warn(`openflix-live ffmpeg exit ${code}`)
  })
  job = { src, proc }
  return job
}

async function waitForPlaylist(file, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (existsSync(file)) {
      const text = readFileSync(file, 'utf8')
      if (text.includes('#EXTINF')) return text
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('playlist HLS não ficou pronta em 20s')
}

async function handlePlaylist(req, res) {
  const src = playlistSrc(req)
  ensureJob(src)
  const playlist = await waitForPlaylist(join(ROOT, 'index.m3u8'))
  const body = rewriteHlsToAbsolute(playlist, originOf(req))
  send(res, 200, body, {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-store',
  })
}

function handleSegment(req, res, name) {
  if (!/^seg\d+\.ts$/.test(name)) {
    send(res, 400, 'pedido recusado')
    return
  }
  const file = join(ROOT, name)
  if (!existsSync(file)) {
    send(res, 404, 'segmento ausente')
    return
  }
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'video/mp2t',
    'Cache-Control': 'no-store',
  })
  const stream = createReadStream(file)
  stream.on('error', () => {
    if (!res.headersSent) send(res, 500, 'segmento ilegível')
    else res.destroy()
  })
  stream.pipe(res)
}

const server = createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
    })
    res.end()
    return
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'method')
    return
  }
  const path = (req.url || '/').split('?')[0]
  if (path === '/health') {
    send(res, 200, 'ok', { 'Content-Type': 'text/plain' })
    return
  }
  if (path === '/live/index.m3u8' || path === '/index.m3u8') {
    handlePlaylist(req, res).catch((error) => {
      send(res, 502, 'live falhou')
      console.warn(`openflix-live playlist fail ${error.message}`)
    })
    return
  }
  const segment = path.match(/^\/(seg\d+\.ts)$/)
  if (segment) {
    handleSegment(req, res, segment[1])
    return
  }
  send(res, 404, 'not found')
})

server.listen(PORT, HOST, () => {
  console.log(`openflix-live hls http://${HOST}:${PORT}`)
})
