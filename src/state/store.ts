export type AuthState = 'setup' | 'polling' | 'error'

export interface PowerwallState {
  authState: AuthState
  siteId: number | null
  siteName: string | null
  // Power values in watts; null until first successful poll
  solarPower: number | null
  batteryPower: number | null
  gridPower: number | null
  homePower: number | null
  soc: number | null               // State of charge 0–100
  gridStatus: string | null        // 'Active' | 'Inactive'
  isPeakPeriod: boolean | null
  stale: boolean
  lastUpdated: number | null       // Unix ms
  lastError: string | null
}

export interface TransitionEvent {
  name: string
  timestamp: number
}

const MAX_EVENTS = 50

let state: PowerwallState = {
  authState: 'setup',
  siteId: null,
  siteName: null,
  solarPower: null,
  batteryPower: null,
  gridPower: null,
  homePower: null,
  soc: null,
  gridStatus: null,
  isPeakPeriod: null,
  stale: false,
  lastUpdated: null,
  lastError: null,
}

const events: TransitionEvent[] = []

export function getState(): Readonly<PowerwallState> {
  return state
}

export function setState(patch: Partial<PowerwallState>): void {
  state = { ...state, ...patch }
}

export function pushEvent(name: string): void {
  events.unshift({ name, timestamp: Date.now() })
  if (events.length > MAX_EVENTS) events.splice(MAX_EVENTS)
}

export function getEvents(): ReadonlyArray<TransitionEvent> {
  return events
}

export function clearEvents(): void {
  events.splice(0)
}
