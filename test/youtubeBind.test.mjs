import { faker } from '@faker-js/faker'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applySetCookies,
  bindYoutubeSession,
  cookieHeader,
  handshakeCookieHeader,
  parseCookieHeader,
  youtubeSessionBound,
} from '../src/youtubeBind.mjs'

faker.seed(20261108)

test('cookieHeader keeps LOGIN_INFO from the YouTube jar', () => {
  const loginInfo = faker.string.alphanumeric(12)

  const header = cookieHeader([
    ['SAPISID', 'abc'],
    ['LOGIN_INFO', loginInfo],
  ])

  assert.match(header, new RegExp(`LOGIN_INFO=${loginInfo}`))
})

test('youtubeSessionBound is false with only Google SID', () => {
  assert.equal(
    youtubeSessionBound([
      ['SAPISID', 'abc'],
      ['SID', 'def'],
    ]),
    false,
  )
})

test('youtubeSessionBound is true with LOGIN_INFO', () => {
  assert.equal(
    youtubeSessionBound([
      ['SAPISID', 'abc'],
      ['LOGIN_INFO', faker.string.alphanumeric(8)],
    ]),
    true,
  )
})

test('applySetCookies replaces stale SAPISID and adds LOGIN_INFO', () => {
  const stale = faker.string.alphanumeric(8)
  const fresh = faker.string.alphanumeric(8)
  const loginInfo = faker.string.alphanumeric(10)
  const next = applySetCookies(
    {
      cookies: `SAPISID=${stale}; SID=def`,
      sapisid: stale,
      identity_cookies: 'ACCOUNT_CHOOSER=chooser',
    },
    [
      `SAPISID=${fresh}; Domain=.youtube.com; Secure`,
      `LOGIN_INFO=${loginInfo}; Domain=.youtube.com; Secure; HttpOnly`,
    ],
  )

  assert.equal(next.sapisid, fresh)
  assert.match(next.cookies, new RegExp(`SAPISID=${fresh}`))
  assert.doesNotMatch(next.cookies, new RegExp(`SAPISID=${stale}`))
  assert.match(next.cookies, new RegExp(`LOGIN_INFO=${loginInfo}`))
  assert.equal(next.identity_cookies, 'ACCOUNT_CHOOSER=chooser')
})

test('applySetCookies drops Max-Age=0 and empty values', () => {
  const sapisid = faker.string.alphanumeric(8)
  const next = applySetCookies(
    {
      cookies: `SAPISID=${sapisid}; SID=keep; LOGIN_INFO=stale`,
      sapisid,
    },
    ['SID=; Max-Age=0; Domain=.youtube.com', 'LOGIN_INFO=; Expires=Sat, 10-Feb-2024 00:00:00 GMT'],
  )

  const names = parseCookieHeader(next.cookies).map(([name]) => name)
  assert.equal(names.includes('SID'), false)
  assert.equal(names.includes('LOGIN_INFO'), false)
  assert.match(next.cookies, new RegExp(`SAPISID=${sapisid}`))
})

test('handshakeCookieHeader sends identity with the Google SID', () => {
  const header = handshakeCookieHeader({
    cookies: 'SAPISID=abc; SID=def',
    sapisid: 'abc',
    identity_cookies: 'ACCOUNT_CHOOSER=chooser; LSID=lsid',
  })

  assert.match(header, /ACCOUNT_CHOOSER=chooser/)
  assert.match(header, /LSID=lsid/)
  assert.match(header, /SAPISID=abc/)
})

test('bindYoutubeSession mints LOGIN_INFO from www.youtube.com HTML without repeating SetSID', async () => {
  const sapisid = faker.string.alphanumeric(8)
  const loginInfo = faker.string.alphanumeric(10)
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(String(url))
    if (String(url).startsWith('https://www.youtube.com')) {
      return {
        status: 200,
        ok: true,
        headers: {
          getSetCookie: () => [
            `LOGIN_INFO=${loginInfo}; Domain=.youtube.com; Secure; HttpOnly`,
            'VISITOR_INFO1_LIVE=visitor; Domain=.youtube.com',
          ],
          get: () => null,
        },
      }
    }
    throw new Error(`unexpected handshake url ${url}`)
  }

  const next = await bindYoutubeSession(
    {
      cookies: `SAPISID=${sapisid}; SID=youtube-sid`,
      sapisid,
      identity_cookies: 'LSID=lsid',
    },
    fetchImpl,
  )

  assert.match(next.cookies, new RegExp(`LOGIN_INFO=${loginInfo}`))
  assert.match(next.cookies, /VISITOR_INFO1_LIVE=visitor/)
  assert.equal(urls.length, 1)
  assert.match(urls[0], /^https:\/\/www\.youtube\.com\/?$/)
})

test('bindYoutubeSession ignores expired SID from anonymous youtube HTML', async () => {
  const sapisid = faker.string.alphanumeric(8)
  const fresh = faker.string.alphanumeric(8)
  const loginInfo = faker.string.alphanumeric(10)
  const fetchImpl = async (url) => {
    const href = String(url)
    if (href.startsWith('https://www.youtube.com')) {
      return {
        status: 200,
        ok: true,
        headers: {
          getSetCookie: () => [
            'SID=; Expires=Sat, 10-Feb-2024 00:00:00 GMT; Domain=.youtube.com',
            'SAPISID=; Max-Age=0; Domain=.youtube.com',
          ],
          get: () => null,
        },
      }
    }
    if (href.includes('ServiceLogin')) {
      return {
        status: 302,
        ok: false,
        headers: {
          getSetCookie: () => [],
          get: (name) =>
            name === 'location' ? 'https://accounts.youtube.com/accounts/SetSID' : null,
        },
      }
    }
    if (href.includes('SetSID')) {
      return {
        status: 302,
        ok: false,
        headers: {
          getSetCookie: () => [
            `SAPISID=${fresh}; Domain=.youtube.com; Secure`,
            `LOGIN_INFO=${loginInfo}; Domain=.youtube.com; Secure; HttpOnly`,
          ],
          get: (name) => (name === 'location' ? 'https://www.youtube.com/' : null),
        },
      }
    }
    throw new Error(`unexpected handshake url ${url}`)
  }

  const next = await bindYoutubeSession(
    {
      cookies: `SAPISID=${sapisid}; SID=google-sid`,
      sapisid,
      identity_cookies: 'LSID=lsid',
    },
    fetchImpl,
  )

  assert.equal(next.sapisid, fresh)
  assert.match(next.cookies, new RegExp(`LOGIN_INFO=${loginInfo}`))
  assert.match(next.cookies, new RegExp(`SAPISID=${fresh}`))
})

test('bindYoutubeSession continue URL aponta para www.youtube.com, não music', async () => {
  const sapisid = faker.string.alphanumeric(8)
  const loginInfo = faker.string.alphanumeric(10)
  const urls = []
  const fetchImpl = async (url) => {
    urls.push(String(url))
    const href = String(url)
    if (href.startsWith('https://www.youtube.com')) {
      return {
        status: 200,
        ok: true,
        headers: { getSetCookie: () => [], get: () => null },
      }
    }
    if (href.includes('ServiceLogin')) {
      assert.match(href, /continue=https%3A%2F%2Fwww\.youtube\.com/)
      assert.equal(href.includes('music.youtube.com'), false)
      return {
        status: 302,
        ok: false,
        headers: {
          getSetCookie: () => [`LOGIN_INFO=${loginInfo}; Domain=.youtube.com; Secure; HttpOnly`],
          get: (name) => (name === 'location' ? 'https://www.youtube.com/' : null),
        },
      }
    }
    throw new Error(`unexpected handshake url ${url}`)
  }

  const next = await bindYoutubeSession(
    {
      cookies: `SAPISID=${sapisid}; SID=google-sid`,
      sapisid,
      identity_cookies: 'LSID=lsid',
    },
    fetchImpl,
  )

  assert.match(next.cookies, new RegExp(`LOGIN_INFO=${loginInfo}`))
  assert.equal(
    urls.some((url) => url.includes('music.youtube.com')),
    false,
  )
})
