import type { PowerwallUnit } from '../types.js'
export type { PowerwallUnit }

export type AuthState = 'setup' | 'polling' | 'error'

export interface PowerwallState {
  authState: AuthState
  siteName: string | null
  // Live power (watts)
  soc: number | null
  gridStatus: string | null       // 'Active' | 'Inactive' | 'Unknown'
  solarPower: number | null
  batteryPower: number | null     // positive = discharging
  gridPower: number | null        // positive = importing
  homePower: number | null
  isPeakPeriod: boolean | null
  // Electrical
  gridVoltage: number | null      // volts
  gridFrequency: number | null    // Hz
  // Operation
  operationMode: string | null    // 'autonomous' | 'backup' | 'self_consumption' | ...
  backupReservePercent: number | null
  // Lifetime energy (Wh)
  solarExportedWh: number | null
  gridImportedWh: number | null
  gridExportedWh: number | null
  batteryChargedWh: number | null
  batteryDischargedWh: number | null
  homeConsumedWh: number | null
  // System info (refreshed hourly)
  nominalCapacityWh: number | null
  numPowerwalls: number | null
  maxDischargePowerW: number | null
  maxChargePowerW: number | null
  utility: string | null
  stateLocation: string | null
  units: PowerwallUnit[] | null
  // Status
  stale: boolean
  lastUpdated: number | null
  lastError: string | null
}

export interface TransitionEvent {
  name: string
  timestamp: number
}

const MAX_EVENTS = 50

let state: PowerwallState = {
  authState: 'setup',
  siteName: null,
  soc: null,
  gridStatus: null,
  solarPower: null,
  batteryPower: null,
  gridPower: null,
  homePower: null,
  isPeakPeriod: null,
  gridVoltage: null,
  gridFrequency: null,
  operationMode: null,
  backupReservePercent: null,
  solarExportedWh: null,
  gridImportedWh: null,
  gridExportedWh: null,
  batteryChargedWh: null,
  batteryDischargedWh: null,
  homeConsumedWh: null,
  nominalCapacityWh: null,
  numPowerwalls: null,
  maxDischargePowerW: null,
  maxChargePowerW: null,
  utility: null,
  stateLocation: null,
  units: null,
  stale: false,
  lastUpdated: null,
  lastError: null,
}

const events: TransitionEvent[] = []

export function getState(): Readonly<PowerwallState> { return state }

export function setState(patch: Partial<PowerwallState>): void {
  state = { ...state, ...patch }
}

export function pushEvent(name: string): void {
  events.unshift({ name, timestamp: Date.now() })
  if (events.length > MAX_EVENTS) events.splice(MAX_EVENTS)
}

export function getEvents(): ReadonlyArray<TransitionEvent> { return events }

export function clearEvents(): void { events.splice(0) }
