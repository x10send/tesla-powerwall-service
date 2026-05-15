import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../src/server.js'
import { setState } from '../src/state/store.js'
import { saveSettings } from '../src/settings.js'

vi.mock('../src/gateway/client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/gateway/client.js')>()
  return { ...real, testConnection: vi.fn(), clearSession: vi.fn() }
})

import { testConnection } from '../src/gateway/client.js'
const mockTestConnection = vi.mocked(testConnection)

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  saveSettings({ gatewayIp: null, gatewayPassword: null, siteName: null })
  setState({ authState: 'setup', siteName: null, stale: false, lastError: null })
  app = await createApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

// ── /health ────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 from a LAN IP', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
  })

  it('returns 200 even from a public IP — health is never blocked', async () => {
    const res = await app.inject({ method: 'GET', url: '/health', remoteAddress: '8.8.8.8' })
    expect(res.statusCode).toBe(200)
  })
})

// ── /status ────────────────────────────────────────────────────────────────

describe('GET /status', () => {
  it('returns 503 with authState:setup when gateway not configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/status' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ authState: 'setup' })
  })

  it('returns 200 with state when polling', async () => {
    setState({
      authState: 'polling',
      siteName: 'My Powerwall',
      soc: 80,
      gridStatus: 'Active',
      solarPower: 3000,
      batteryPower: -500,
      gridPower: 0,
      homePower: 2500,
      stale: false,
      lastUpdated: Date.now(),
      lastError: null,
    })
    const res = await app.inject({ method: 'GET', url: '/status' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.authState).toBe('polling')
    expect(body.soc).toBe(80)
    expect(body.gridStatus).toBe('Active')
    expect(body.stale).toBe(false)
  })

  it('includes stale:true when data is stale', async () => {
    setState({ authState: 'polling', stale: true, lastUpdated: Date.now() - 120_000 })
    const res = await app.inject({ method: 'GET', url: '/status' })
    expect(res.statusCode).toBe(200)
    expect(res.json().stale).toBe(true)
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({ method: 'GET', url: '/status', remoteAddress: '203.0.113.1' })
    expect(res.statusCode).toBe(403)
  })
})

// ── /events ────────────────────────────────────────────────────────────────

describe('GET /events', () => {
  it('returns an empty events array initially', async () => {
    const res = await app.inject({ method: 'GET', url: '/events' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ events: [] })
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({ method: 'GET', url: '/events', remoteAddress: '1.1.1.1' })
    expect(res.statusCode).toBe(403)
  })
})

// ── /ui ────────────────────────────────────────────────────────────────────

describe('GET /ui', () => {
  it('returns the setup page when gateway not configured', async () => {
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toContain('Connect Powerwall Gateway')
  })

  it('returns the dashboard when gateway is configured', async () => {
    saveSettings({ gatewayIp: '192.168.1.100', gatewayPassword: 'test-password', siteName: 'Home' })
    setState({
      authState: 'polling',
      siteName: 'Home',
      soc: 72,
      gridStatus: 'Active',
      solarPower: 2000,
      batteryPower: 0,
      gridPower: 500,
      homePower: 2500,
      stale: false,
      lastUpdated: Date.now(),
      lastError: null,
    })
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Powerwall Bridge')
    expect(res.body).toContain('72%')
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({ method: 'GET', url: '/ui', remoteAddress: '8.8.8.8' })
    expect(res.statusCode).toBe(403)
  })

  it('sets security headers on HTML responses', async () => {
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.headers['content-security-policy']).toMatch(/default-src 'none'/)
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })
})

// ── POST /ui/settings ──────────────────────────────────────────────────────

describe('POST /ui/settings', () => {
  it('saves valid thresholds and redirects to /ui/settings', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ui/settings',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'socLow=20&socHigh=90',
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toBe('/ui/settings?saved=1')

    const { readSettings } = await import('../src/settings.js')
    const s = readSettings()
    expect(s.socLow).toBe(20)
    expect(s.socHigh).toBe(90)
  })

  it('treats non-numeric threshold input as null (does not save NaN)', async () => {
    await app.inject({
      method: 'POST',
      url: '/ui/settings',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'socLow=abc&socHigh=',
    })
    const { readSettings } = await import('../src/settings.js')
    const s = readSettings()
    expect(s.socLow).toBeNull()
    expect(s.socHigh).toBeNull()
  })

  it('clamps out-of-range values to 0–100', async () => {
    await app.inject({
      method: 'POST',
      url: '/ui/settings',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'socLow=-5&socHigh=150',
    })
    const { readSettings } = await import('../src/settings.js')
    const s = readSettings()
    expect(s.socLow).toBe(0)
    expect(s.socHigh).toBe(100)
  })

  it('saves a peak schedule window', async () => {
    await app.inject({
      method: 'POST',
      url: '/ui/settings',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'w0_startHour=16&w0_endHour=21&w0_monthStart=5&w0_monthEnd=10',
    })
    const { readSettings } = await import('../src/settings.js')
    const s = readSettings()
    expect(s.peakSchedule).toHaveLength(1)
    expect(s.peakSchedule[0]).toMatchObject({ startHour: 16, endHour: 21, monthStart: 5, monthEnd: 10 })
  })

  it('saves multiple peak schedule windows', async () => {
    await app.inject({
      method: 'POST',
      url: '/ui/settings',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'w0_startHour=14&w0_endHour=20&w0_monthStart=5&w0_monthEnd=10&w1_startHour=5&w1_endHour=9&w1_monthStart=11&w1_monthEnd=4',
    })
    const { readSettings } = await import('../src/settings.js')
    const s = readSettings()
    expect(s.peakSchedule).toHaveLength(2)
  })

  it('ignores incomplete peak schedule windows', async () => {
    await app.inject({
      method: 'POST',
      url: '/ui/settings',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'w0_startHour=16&w0_endHour=21',   // missing monthStart/End
    })
    const { readSettings } = await import('../src/settings.js')
    const s = readSettings()
    expect(s.peakSchedule).toHaveLength(0)
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ui/settings',
      remoteAddress: '8.8.8.8',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'socLow=20&socHigh=90',
    })
    expect(res.statusCode).toBe(403)
  })
})

// ── POST /ui/gateway/connect ──────────────────────────────────────────────

describe('POST /ui/gateway/connect', () => {
  it('renders error page when IP is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/ui/gateway/connect',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'gatewayIp=&gatewayPassword=test-password',
    })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('required')
  })

  it('renders error page when testConnection throws', async () => {
    mockTestConnection.mockRejectedValue(new Error('Connection refused'))
    const res = await app.inject({
      method: 'POST',
      url: '/ui/gateway/connect',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'gatewayIp=192.168.1.100&gatewayPassword=WRONG',
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toContain('error-box')
  })

  it('saves settings and redirects on successful connection', async () => {
    mockTestConnection.mockResolvedValue(undefined)
    const res = await app.inject({
      method: 'POST',
      url: '/ui/gateway/connect',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'gatewayIp=192.168.1.100&gatewayPassword=test-password',
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toBe('/ui')

    const { readSettings } = await import('../src/settings.js')
    const s = readSettings()
    expect(s.gatewayIp).toBe('192.168.1.100')
    expect(s.gatewayPassword).toBe('test-password')
  })
})

// ── POST /ui/gateway/disconnect ───────────────────────────────────────────

describe('POST /ui/gateway/disconnect', () => {
  it('clears gateway config and redirects to /ui', async () => {
    saveSettings({ gatewayIp: '192.168.1.100', gatewayPassword: 'test-password' })
    setState({ authState: 'polling' })

    const res = await app.inject({ method: 'POST', url: '/ui/gateway/disconnect' })
    expect(res.statusCode).toBe(302)
    expect(res.headers['location']).toBe('/ui')

    const { readSettings } = await import('../src/settings.js')
    const s = readSettings()
    expect(s.gatewayIp).toBeNull()
    expect(s.gatewayPassword).toBeNull()
  })
})
