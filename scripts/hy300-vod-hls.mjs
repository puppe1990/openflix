#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { ffmpegHlsArgs, parseVodSrc, rewriteHlsToAbsolute, vodJobId } from '../src/hy300VodHls.mjs'

const HOST = process.env.HY300_VOD_HOST || '192.168.15.3'
const PORT = Number(process.env.HY300_VOD_PORT || 8793)
const ROOT = process.env.HY300_VOD_DIR || '/tmp/openflix-vod-hls'
const jobs = new Map()

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

function ensureJob(src) {
  const id = vodJobId(src)
  const existing = jobs.get(id)
  if (existing && existing.proc.exitCode == null) return existing
  mkdirSync(ROOT, { recursive: true })
  const dir = join(ROOT, id)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const ffmpeg = process.env.HY300_FFMPEG || 'ffmpeg'
  const proc = spawn(ffmpeg, ffmpegHlsArgs({ src, dir }), {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  proc.stderr.on('data', () => {})
  proc.on('exit', (code) => {
    if (code && code !== 0) console.warn(`openflix-vod job ${id} exit ${code}`)
  })
  const job = { id, dir, proc }
  jobs.set(id, job)
  return job
}

async function waitForPlaylist(file, timeoutMs = 50000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (existsSync(file)) {
      const text = readFileSync(file, 'utf8')
      if (text.includes('#EXTINF')) return text
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('playlist HLS não ficou pronta em 50s')
}

async function handlePlaylist(req, res) {
  const href = `http://${req.headers.host || `${HOST}:${PORT}`}${req.url}`
  const src = parseVodSrc(href)
  const job = ensureJob(src)
  const playlist = await waitForPlaylist(join(job.dir, 'index.m3u8'))
  const body = rewriteHlsToAbsolute(playlist, `${originOf(req)}/v/${job.id}`)
  send(res, 200, body, {
    'Content-Type': 'application/vnd.apple.mpegurl',
    'Cache-Control': 'no-store',
  })
}

function handleSegment(req, res, id, name) {
  if (!/^[a-f0-9]{16}$/.test(id) || !/^seg\d+\.ts$/.test(name)) {
    send(res, 400, 'pedido recusado')
    return
  }
  const file = join(ROOT, id, name)
  if (!existsSync(file)) {
    send(res, 404, 'segmento ausente')
    return
  }
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'video/mp2t',
    'Cache-Control': 'public, max-age=60',
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
  if (path === '/v/index.m3u8') {
    handlePlaylist(req, res).catch((error) => {
      send(res, 502, 'transcode falhou')
      console.warn(`openflix-vod playlist fail ${error.message}`)
    })
    return
  }
  const segment = path.match(/^\/v\/([a-f0-9]{16})\/(seg\d+\.ts)$/)
  if (segment) {
    handleSegment(req, res, segment[1], segment[2])
    return
  }
  send(res, 404, 'not found')
})

server.listen(PORT, HOST, () => {
  console.log(`openflix-vod hls http://${HOST}:${PORT}`)
})
