import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

// Keep real error classes so api.ts instanceof checks work; only stub the function.
vi.mock('../src/tesla/client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/tesla/client.js')>()
  return { ...real, setGridMode: vi.fn() }
})

// Stub refreshAccessToken so token-refresh tests don't hit the network.
vi.mock('../src/auth/flow.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/auth/flow.js')>()
  return { ...real, refreshAccessToken: vi.fn() }
})

import { setGridMode, CommandNotAvailableError, AuthError, RateLimitError } from '../src/tesla/client.js'
import { refreshAccessToken } from '../src/auth/flow.js'
import { createApp } from '../src/server.js'
import { setState } from '../src/state/store.js'
import { saveTokens, clearTokens } from '../src/auth/tokens.js'
import { saveSettings } from '../src/settings.js'

const VALID_TOKEN = { accessToken: 'acc-tok', refreshToken: 'ref-tok', expiresAt: Date.now() + 3_600_000 }
const EXPIRING_TOKEN = { ...VALID_TOKEN, expiresAt: Date.now() + 60_000 }  // 1 min — within 5-min window
const REFRESHED_TOKEN = { accessToken: 'new-acc', refreshToken: 'new-ref', expiresAt: Date.now() + 3_600_000 }

const mockSetGridMode = vi.mocked(setGridMode)
const mockRefreshAccessToken = vi.mocked(refreshAccessToken)

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  await clearTokens()
  setState({ authState: 'polling', siteId: null, siteName: null, stale: false, lastError: null })
  saveSettings({ siteId: 42, siteName: 'Home' })
  await saveTokens(VALID_TOKEN)
  setState({ authState: 'polling' })
  mockSetGridMode.mockResolvedValue(undefined)
  app = await createApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

// ── Happy path ─────────────────────────────────────────────────────────────

describe('POST /grid/on', () => {
  it('returns ok:true and calls setGridMode with onGrid=true', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, mode: 'on-grid' })
    expect(mockSetGridMode).toHaveBeenCalledOnce()
    expect(mockSetGridMode).toHaveBeenCalledWith(42, true, 'acc-tok')
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/on', remoteAddress: '8.8.8.8' })
    expect(res.statusCode).toBe(403)
    expect(mockSetGridMode).not.toHaveBeenCalled()
  })
})

describe('POST /grid/off', () => {
  it('returns ok:true and calls setGridMode with onGrid=false', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/off' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, mode: 'off-grid' })
    expect(mockSetGridMode).toHaveBeenCalledWith(42, false, 'acc-tok')
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/off', remoteAddress: '203.0.113.5' })
    expect(res.statusCode).toBe(403)
    expect(mockSetGridMode).not.toHaveBeenCalled()
  })
})

// ── Pre-flight guard failures ──────────────────────────────────────────────

describe('pre-flight guards', () => {
  it('returns 503 when authState is not polling', async () => {
    setState({ authState: 'setup' })
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toMatch(/not authenticated/i)
    expect(mockSetGridMode).not.toHaveBeenCalled()
  })

  it('returns 503 when authState is error', async () => {
    setState({ authState: 'error' })
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(503)
    expect(mockSetGridMode).not.toHaveBeenCalled()
  })

  it('returns 503 when siteId is not configured', async () => {
    saveSettings({ siteId: null })
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toMatch(/no site/i)
    expect(mockSetGridMode).not.toHaveBeenCalled()
  })

  it('returns 503 when no tokens are stored', async () => {
    await clearTokens()
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toMatch(/no auth tokens/i)
    expect(mockSetGridMode).not.toHaveBeenCalled()
  })
})

// ── Token refresh ──────────────────────────────────────────────────────────

describe('token refresh', () => {
  it('refreshes the token when it is expiring soon and proceeds with the new token', async () => {
    await saveTokens(EXPIRING_TOKEN)
    mockRefreshAccessToken.mockResolvedValue(REFRESHED_TOKEN)

    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(200)
    expect(mockRefreshAccessToken).toHaveBeenCalledWith(EXPIRING_TOKEN.refreshToken)
    expect(mockSetGridMode).toHaveBeenCalledWith(42, true, REFRESHED_TOKEN.accessToken)
  })

  it('does not refresh when token has plenty of time remaining', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(200)
    expect(mockRefreshAccessToken).not.toHaveBeenCalled()
    expect(mockSetGridMode).toHaveBeenCalledWith(42, true, VALID_TOKEN.accessToken)
  })
})

// ── Tesla API error mapping ────────────────────────────────────────────────

describe('Tesla API error handling', () => {
  it('maps CommandNotAvailableError to 503 with a hint about energy_cmds scope', async () => {
    mockSetGridMode.mockRejectedValue(new CommandNotAvailableError('energy_cmds scope not granted'))
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.error).toBeTruthy()
    expect(body.hint).toMatch(/energy_cmds/i)
  })

  it('maps AuthError to 401', async () => {
    mockSetGridMode.mockRejectedValue(new AuthError('Unauthorized'))
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBeTruthy()
  })

  it('maps RateLimitError to 429', async () => {
    mockSetGridMode.mockRejectedValue(new RateLimitError('Rate limited'))
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(429)
    expect(res.json().error).toBeTruthy()
  })

  it('maps unexpected errors to 500', async () => {
    mockSetGridMode.mockRejectedValue(new Error('unexpected upstream failure'))
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toMatch(/unexpected upstream failure/)
  })

  it('same error mapping applies to /grid/off', async () => {
    mockSetGridMode.mockRejectedValue(new AuthError('Unauthorized'))
    const res = await app.inject({ method: 'POST', url: '/grid/off' })
    expect(res.statusCode).toBe(401)
  })
})
