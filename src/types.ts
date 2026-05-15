// Shared domain types used across gateway, state, and UI layers.

export interface PowerwallUnit {
  serial: string           // last 6 chars of package serial number
  nominalCapacityWh: number
  nominalEnergyWh: number  // current energy remaining
  powerW: number
  opState: string
  backupReady: boolean
}
