import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../src/server.js'
import { setState } from '../src/state/store.js'
import { clearTokens } from '../src/auth/tokens.js'

let app: FastifyInstance

beforeEach(async () => {
  await clearTokens()
  setState({ authState: 'setup', siteId: null, siteName: null, stale: false, lastError: null })
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
  it('returns 503 with authState:setup when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/status' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ authState: 'setup' })
  })

  it('returns 200 with state when authenticated', async () => {
    setState({
      authState: 'polling',
      siteId: 123,
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
    setState({ authState: 'polling', stale: true, siteId: 123, lastUpdated: Date.now() - 120_000 })
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
  it('returns the setup page when not authenticated', async () => {
    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/html/)
    expect(res.body).toContain('Connect Tesla Account')
  })

  it('returns the dashboard when authenticated', async () => {
    setState({
      authState: 'polling',
      siteId: 123,
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

    // Write a fake token so loadTokens() returns non-null
    const { saveTokens } = await import('../src/auth/tokens.js')
    await saveTokens({ accessToken: 'fake', refreshToken: 'fake', expiresAt: Date.now() + 3600_000 })

    const res = await app.inject({ method: 'GET', url: '/ui' })
    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('Powerwall Bridge')
    expect(res.body).toContain('72%')
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({ method: 'GET', url: '/ui', remoteAddress: '8.8.8.8' })
    expect(res.statusCode).toBe(403)
  })
})
