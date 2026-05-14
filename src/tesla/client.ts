import type { EnergySite, LiveStatus, SiteInfo, TariffRate } from './types.js'

const BASE = 'https://fleet-api.prd.na.vn.cloud.tesla.com'

async function get<T>(path: string, accessToken: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (resp.status === 401) {
    throw new AuthError('Unauthorized — token may be revoked or expired')
  }

  if (resp.status === 429) {
    throw new RateLimitError('Rate limited by Tesla API')
  }

  if (!resp.ok) {
    throw new Error(`Tesla API error ${resp.status} on ${path}`)
  }

  const body = await resp.json() as { response: T }
  return body.response
}

export async function getEnergySites(accessToken: string): Promise<EnergySite[]> {
  const products = await get<Array<{ energy_site_id?: number; resource_type?: string; display_name?: string }>>(
    '/api/1/products',
    accessToken,
  )
  return products
    .filter(p => p.energy_site_id != null && p.resource_type === 'energy')
    .map(p => ({
      energy_site_id: p.energy_site_id!,
      resource_type: p.resource_type!,
      display_name: p.display_name ?? 'Powerwall',
    }))
}

export async function getLiveStatus(siteId: number, accessToken: string): Promise<LiveStatus> {
  return get<LiveStatus>(`/api/1/energy_sites/${siteId}/live_status`, accessToken)
}

export async function getSiteInfo(siteId: number, accessToken: string): Promise<SiteInfo> {
  return get<SiteInfo>(`/api/1/energy_sites/${siteId}/site_info`, accessToken)
}

export async function getTariffRate(siteId: number, accessToken: string): Promise<TariffRate | null> {
  try {
    return await get<TariffRate>(`/api/1/energy_sites/${siteId}/tariff_rate`, accessToken)
  } catch (err) {
    // Endpoint may not exist or may not be populated for all accounts — treat as non-fatal
    if (err instanceof Error && err.message.includes('404')) return null
    throw err
  }
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RateLimitError'
  }
}
