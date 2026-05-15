import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'

vi.mock('../src/gateway/client.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/gateway/client.js')>()
  return { ...real, setGatewayGridMode: vi.fn() }
})

import { setGatewayGridMode, GatewayAuthError } from '../src/gateway/client.js'
import { createApp } from '../src/server.js'
import { saveSettings } from '../src/settings.js'

const mockSetGatewayGridMode = vi.mocked(setGatewayGridMode)

let app: FastifyInstance

beforeEach(async () => {
  vi.clearAllMocks()
  saveSettings({ gatewayIp: '192.168.1.100', gatewayPassword: 'test-password' })
  mockSetGatewayGridMode.mockResolvedValue(undefined)
  app = await createApp()
  await app.ready()
})

afterEach(async () => {
  await app.close()
})

// ── Happy path ─────────────────────────────────────────────────────────────

describe('POST /grid/on', () => {
  it('returns ok:true and calls setGatewayGridMode with onGrid=true', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, mode: 'on-grid' })
    expect(mockSetGatewayGridMode).toHaveBeenCalledOnce()
    expect(mockSetGatewayGridMode).toHaveBeenCalledWith('192.168.1.100', 'test-password', true)
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/on', remoteAddress: '8.8.8.8' })
    expect(res.statusCode).toBe(403)
    expect(mockSetGatewayGridMode).not.toHaveBeenCalled()
  })
})

describe('POST /grid/off', () => {
  it('returns ok:true and calls setGatewayGridMode with onGrid=false', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/off' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, mode: 'off-grid' })
    expect(mockSetGatewayGridMode).toHaveBeenCalledWith('192.168.1.100', 'test-password', false)
  })

  it('returns 403 for a public IP', async () => {
    const res = await app.inject({ method: 'POST', url: '/grid/off', remoteAddress: '203.0.113.5' })
    expect(res.statusCode).toBe(403)
    expect(mockSetGatewayGridMode).not.toHaveBeenCalled()
  })
})

// ── Pre-flight guard ───────────────────────────────────────────────────────

describe('pre-flight guard', () => {
  it('returns 503 when gateway IP is not configured', async () => {
    saveSettings({ gatewayIp: null })
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(503)
    expect(res.json().error).toMatch(/not configured/i)
    expect(mockSetGatewayGridMode).not.toHaveBeenCalled()
  })

  it('returns 503 when gateway password is not configured', async () => {
    saveSettings({ gatewayPassword: null })
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(503)
    expect(mockSetGatewayGridMode).not.toHaveBeenCalled()
  })
})

// ── Error handling ─────────────────────────────────────────────────────────

describe('gateway error handling', () => {
  it('maps GatewayAuthError to 401', async () => {
    mockSetGatewayGridMode.mockRejectedValue(new GatewayAuthError('Session expired'))
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBeTruthy()
  })

  it('maps unexpected errors to 500', async () => {
    mockSetGatewayGridMode.mockRejectedValue(new Error('Connection refused'))
    const res = await app.inject({ method: 'POST', url: '/grid/on' })
    expect(res.statusCode).toBe(500)
    expect(res.json().error).toMatch(/Connection refused/)
  })

  it('same error mapping applies to /grid/off', async () => {
    mockSetGatewayGridMode.mockRejectedValue(new GatewayAuthError('Auth failed'))
    const res = await app.inject({ method: 'POST', url: '/grid/off' })
    expect(res.statusCode).toBe(401)
  })
})
