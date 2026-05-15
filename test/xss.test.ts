/**
 * Injection tests — every string that originates outside this process (gateway API
 * responses, error messages, user-supplied event names) must appear HTML-escaped
 * in rendered pages.  A raw '<', '>', '"', or '&' in the response body is a failure.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../src/server.js'
import { setState, pushEvent, clearEvents } from '../src/state/store.js'
import { saveSettings } from '../src/settings.js'

const PAYLOAD   = '<script>alert("xss")</script>'
const ESCAPED   = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
const IMG_PAYLOAD = '<img src=x onerror=alert(1)>'
const IMG_ESCAPED = '&lt;img src=x onerror=alert(1)&gt;'

const BASE_STATE = {
  authState: 'polling' as const,
  siteName: 'Safe Site',
  soc: 80,
  gridStatus: 'Active' as const,
  solarPower: 2000,
  batteryPower: 0,
  gridPower: 0,
  homePower: 2000,
  isPeakPeriod: false,
  stale: false,
  lastUpdated: Date.now(),
  lastError: null,
}

let app: FastifyInstance

beforeEach(async () => {
  clearEvents()
  setState({ ...BASE_STATE })
  // Provide gateway config so dashboard is shown (not setup page)
  saveSettings({ gatewayIp: '10.0.0.1', gatewayPassword: 'test', siteName: 'Safe Site' })
  app = await createApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

// ── Dashboard (GET /ui when gateway configured) ────────────────────────────

describe('dashboard XSS: siteName from gateway API', () => {
  it('escapes HTML in siteName', async () => {
    setState({ siteName: PAYLOAD })
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.body).not.toContain(PAYLOAD)
    expect(res.body).toContain(ESCAPED)
  })

  it('escapes ampersands in siteName', async () => {
    setState({ siteName: 'Solar & Wind' })
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.body).not.toContain('Solar & Wind')
    expect(res.body).toContain('Solar &amp; Wind')
  })
})

describe('dashboard XSS: lastError from exception messages', () => {
  it('escapes HTML in lastError shown in stale banner', async () => {
    setState({ stale: true, lastError: IMG_PAYLOAD })
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.body).not.toContain(IMG_PAYLOAD)
    expect(res.body).toContain(IMG_ESCAPED)
  })

  it('escapes HTML in lastError shown in auth-error banner', async () => {
    setState({ authState: 'error', lastError: PAYLOAD })
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.body).not.toContain(PAYLOAD)
    expect(res.body).toContain(ESCAPED)
  })
})

describe('dashboard XSS: event names via pushEvent', () => {
  it('escapes HTML injected through pushEvent', async () => {
    pushEvent(PAYLOAD)
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.body).not.toContain(PAYLOAD)
    expect(res.body).toContain(ESCAPED)
  })

  it('escapes attribute-breaking quote in event name', async () => {
    pushEvent('grid_lost"><script>evil()</script>')
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.body).not.toContain('<script>evil()</script>')
  })
})

// ── Setup page (GET /ui when gateway not configured) ───────────────────────

describe('setup page XSS: error message from gateway connection failure', () => {
  it('escapes HTML in the error param', async () => {
    const { renderSetup } = await import('../src/ui/templates.js')
    const html = renderSetup({ error: PAYLOAD })
    expect(html).not.toContain(PAYLOAD)
    expect(html).toContain(ESCAPED)
  })

  it('escapes HTML in error with attribute-breaking quote', async () => {
    const { renderSetup } = await import('../src/ui/templates.js')
    const html = renderSetup({ error: '">evil' })
    expect(html).not.toContain('">evil')
    expect(html).toContain('&quot;&gt;evil')
  })
})

// ── Verify non-HTML characters pass through unmodified ─────────────────────

describe('safe strings are not over-escaped', () => {
  it('renders a normal site name correctly', async () => {
    setState({ siteName: 'My Powerwall' })
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.body).toContain('My Powerwall')
  })

  it('renders a normal event name correctly', async () => {
    pushEvent('grid_lost')
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.body).toContain('grid_lost')
  })
})
