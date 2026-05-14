import { config } from '../config.js'
import type { TokenSet } from './tokens.js'

const AUTH_BASE = 'https://auth.tesla.com/oauth2/v3'
const TOKEN_BASE = 'https://fleet-auth.prd.vn.cloud.tesla.com/oauth2/v3'
const REDIRECT_URI = 'https://auth.tesla.com/void/callback'
const AUDIENCE = 'https://fleet-api.prd.na.vn.cloud.tesla.com'
const SCOPES = 'openid offline_access energy_device_data energy_cmds'

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  })
  return `${AUTH_BASE}/authorize?${params}`
}

export function extractCodeFromCallbackUrl(rawUrl: string): { code: string; state: string } | null {
  try {
    const url = new URL(rawUrl)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return null
    return { code, state }
  } catch {
    return null
  }
}

export async function exchangeCodeForTokens(code: string): Promise<TokenSet> {
  const resp = await fetch(`${TOKEN_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: REDIRECT_URI,
      audience: AUDIENCE,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Token exchange failed (${resp.status}): ${body}`)
  }

  const data = await resp.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const resp = await fetch(`${TOKEN_BASE}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`Token refresh failed (${resp.status}): ${body}`)
  }

  const data = await resp.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}
