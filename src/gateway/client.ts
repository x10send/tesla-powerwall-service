import { Agent, fetch as undiciFetch } from 'undici'
import type { PowerwallUnit } from '../types.js'
export type { PowerwallUnit }

const agent = new Agent({ connect: { rejectUnauthorized: false } })

// Wraps undici fetch with SSL-bypass agent scoped only to gateway calls
async function gFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<{ ok: boolean; status: number; headers: { get(n: string): string | null; getSetCookie(): string[] }; json(): Promise<unknown> }> {
  return undiciFetch(url, { ...init, dispatcher: agent } as Parameters<typeof undiciFetch>[1]) as never
}

interface Session {
  ip: string
  cookies: string
  expiresAt: number
}

let session: Session | null = null
const SESSION_TTL = 45 * 60 * 1000

async function authenticate(ip: string, password: string): Promise<string> {
  const resp = await gFetch(`https://${ip}/api/login/Basic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'customer', password, email: '' }),
  })
  if (!resp.ok) throw new GatewayAuthError(`Authentication failed (${resp.status})`)
  const cookies = resp.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
  if (!cookies) throw new GatewayAuthError('No session cookies returned from gateway')
  return cookies
}

async function ensureSession(ip: string, password: string): Promise<Session> {
  if (session?.ip === ip && Date.now() < session.expiresAt) return session
  const cookies = await authenticate(ip, password)
  session = { ip, cookies, expiresAt: Date.now() + SESSION_TTL }
  return session
}

export function clearSession(): void {
  session = null
}

// ── Data types ──────────────────────────────────────────────────────────────

export interface GatewayData {
  soc: number
  solarPower: number
  batteryPower: number
  gridPower: number
  homePower: number
  gridStatus: 'Active' | 'Inactive' | 'Unknown'
  gridVoltage: number
  gridFrequency: number
  operationMode: string
  backupReservePercent: number
  solarExportedWh: number
  gridImportedWh: number
  gridExportedWh: number
  batteryChargedWh: number
  batteryDischargedWh: number
  homeConsumedWh: number
}

export interface GatewaySystemInfo {
  siteName: string
  timezone: string
  nominalCapacityWh: number
  numPowerwalls: number
  maxDischargePowerW: number
  maxChargePowerW: number
  utility: string
  stateLocation: string
  units: PowerwallUnit[]
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function pollGateway(ip: string, password: string): Promise<GatewayData> {
  const sess = await ensureSession(ip, password)
  try {
    return await fetchLiveData(sess)
  } catch (err) {
    if (err instanceof GatewayAuthError) {
      session = null
      const cookies = await authenticate(ip, password)
      session = { ip, cookies, expiresAt: Date.now() + SESSION_TTL }
      return fetchLiveData(session)
    }
    throw err
  }
}

export async function fetchSystemInfo(ip: string, password: string): Promise<GatewaySystemInfo> {
  const sess = await ensureSession(ip, password)
  const h = { Cookie: sess.cookies }

  const [siteResp, sysResp] = await Promise.all([
    gFetch(`https://${ip}/api/site_info`, { headers: h }),
    gFetch(`https://${ip}/api/system_status`, { headers: h }),
  ])

  if (siteResp.status === 401 || sysResp.status === 401) {
    session = null
    throw new GatewayAuthError('Session expired fetching system info')
  }

  const site = await siteResp.json() as SiteInfoResponse
  const sys = await sysResp.json() as SystemStatusResponse

  const units: PowerwallUnit[] = (sys.battery_blocks ?? []).map(b => ({
    serial: (b.PackageSerialNumber ?? b.package_serial_number ?? '').slice(-6) || '??????',
    nominalCapacityWh: b.nominal_full_pack_energy ?? 0,
    nominalEnergyWh: b.nominal_energy_remaining ?? 0,
    powerW: b.p_out ?? 0,
    opState: b.OpSeqState ?? 'Unknown',
    backupReady: b.backup_ready ?? false,
  }))

  return {
    siteName: (site.site_name ?? '').trim(),
    timezone: site.timezone ?? '',
    nominalCapacityWh: sys.nominal_full_pack_energy ?? 0,
    numPowerwalls: sys.available_blocks ?? 0,
    maxDischargePowerW: sys.max_discharge_power ?? 0,
    maxChargePowerW: sys.max_charge_power ?? 0,
    utility: site.grid_code?.utility ?? '',
    stateLocation: site.grid_code?.state ?? '',
    units,
  }
}

export async function testConnection(ip: string, password: string): Promise<void> {
  session = null  // Force fresh auth
  await authenticate(ip, password)
}

export async function setGatewayGridMode(ip: string, password: string, onGrid: boolean): Promise<void> {
  const sess = await ensureSession(ip, password)
  const mode = onGrid ? 'backup' : 'intentional_reconnect_failsafe'

  const resp = await gFetch(`https://${ip}/api/v2/islanding/mode`, {
    method: 'POST',
    headers: { Cookie: sess.cookies, 'Content-Type': 'application/json' },
    body: JSON.stringify({ island_mode: mode }),
  })

  if (resp.status === 401) {
    session = null
    throw new GatewayAuthError('Session expired during grid mode command')
  }
  if (!resp.ok) throw new Error(`Grid mode command failed (${resp.status})`)
}

// ── Internal ─────────────────────────────────────────────────────────────────

async function fetchLiveData(sess: Session): Promise<GatewayData> {
  const h = { Cookie: sess.cookies }
  const base = `https://${sess.ip}`

  const [soeResp, aggResp, gridResp, opResp] = await Promise.all([
    gFetch(`${base}/api/system_status/soe`, { headers: h }),
    gFetch(`${base}/api/meters/aggregates`, { headers: h }),
    gFetch(`${base}/api/system_status/grid_status`, { headers: h }),
    gFetch(`${base}/api/operation`, { headers: h }),
  ])

  for (const resp of [soeResp, aggResp, gridResp, opResp]) {
    if (resp.status === 401) {
      session = null
      throw new GatewayAuthError('Session expired')
    }
    if (!resp.ok) throw new Error(`Gateway API error ${resp.status}`)
  }

  const soe = await soeResp.json() as { percentage: number }
  const agg = await aggResp.json() as AggregatesResponse
  const grid = await gridResp.json() as { grid_status: string }
  const op = await opResp.json() as { real_mode: string; backup_reserve_percent: number }

  return {
    soc: soe.percentage,
    solarPower: agg.solar.instant_power,
    batteryPower: agg.battery.instant_power,
    gridPower: agg.site.instant_power,
    homePower: agg.load.instant_power,
    gridStatus: mapGridStatus(grid.grid_status),
    gridVoltage: agg.site.instant_average_voltage,
    gridFrequency: agg.battery.frequency,  // battery meter has the accurate frequency reading
    operationMode: op.real_mode,
    backupReservePercent: op.backup_reserve_percent,
    solarExportedWh: agg.solar.energy_exported,
    gridImportedWh: agg.site.energy_imported,
    gridExportedWh: agg.site.energy_exported,
    batteryChargedWh: agg.battery.energy_imported,
    batteryDischargedWh: agg.battery.energy_exported,
    homeConsumedWh: agg.load.energy_imported,
  }
}

function mapGridStatus(raw: string): 'Active' | 'Inactive' | 'Unknown' {
  if (raw === 'SystemGridConnected') return 'Active'
  if (raw.includes('Island')) return 'Inactive'
  return 'Unknown'
}

// ── Gateway response shapes ───────────────────────────────────────────────────

interface Meter {
  instant_power: number
  instant_average_voltage: number
  frequency: number
  energy_exported: number
  energy_imported: number
}

interface AggregatesResponse {
  solar: Meter
  battery: Meter
  site: Meter
  load: Meter
}

interface SiteInfoResponse {
  site_name: string
  timezone: string
  grid_code: { utility: string; state: string }
}

interface BatteryBlock {
  PackageSerialNumber?: string   // PascalCase in most firmware versions
  package_serial_number?: string // snake_case fallback
  nominal_full_pack_energy: number
  nominal_energy_remaining: number
  p_out: number
  OpSeqState: string
  backup_ready: boolean
}

interface SystemStatusResponse {
  nominal_full_pack_energy: number
  available_blocks: number
  max_discharge_power: number
  max_charge_power: number
  battery_blocks: BatteryBlock[]
}

export class GatewayAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GatewayAuthError'
  }
}
