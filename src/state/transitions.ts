import { getState, pushEvent } from './store.js'
import type { GatewayData } from '../gateway/client.js'
import { readSocThresholds } from '../settings.js'

const BATTERY_DEADBAND_W = 100

export function detectTransitions(data: GatewayData, isPeakPeriod: boolean | null): void {
  const prev = getState()
  const { socLow, socHigh } = readSocThresholds()

  // Grid status transitions
  if (prev.gridStatus !== null) {
    if (prev.gridStatus !== 'Inactive' && data.gridStatus === 'Inactive') {
      pushEvent('grid_lost')
    } else if (prev.gridStatus === 'Inactive' && data.gridStatus === 'Active') {
      pushEvent('grid_restored')
    }
  }

  // SoC low threshold transitions
  if (prev.soc !== null && socLow !== null) {
    if (prev.soc >= socLow && data.soc < socLow) {
      pushEvent('soc_below_threshold')
    } else if (prev.soc < socLow && data.soc >= socLow) {
      pushEvent('soc_above_low_threshold')
    }
  }

  // SoC high threshold transitions
  if (prev.soc !== null && socHigh !== null) {
    if (prev.soc < socHigh && data.soc >= socHigh) {
      pushEvent('soc_above_threshold')
    } else if (prev.soc >= socHigh && data.soc < socHigh) {
      pushEvent('soc_below_high_threshold')
    }
  }

  // Peak period transitions
  if (isPeakPeriod !== null && prev.isPeakPeriod !== null) {
    if (!prev.isPeakPeriod && isPeakPeriod) {
      pushEvent('peak_start')
    } else if (prev.isPeakPeriod && !isPeakPeriod) {
      pushEvent('peak_end')
    }
  }

  // Battery charging/discharging transitions (deadband avoids noise near zero)
  if (prev.batteryPower !== null && data.batteryPower !== null) {
    if (prev.batteryPower > BATTERY_DEADBAND_W && data.batteryPower < -BATTERY_DEADBAND_W) {
      pushEvent('battery_charging')
    } else if (prev.batteryPower < -BATTERY_DEADBAND_W && data.batteryPower > BATTERY_DEADBAND_W) {
      pushEvent('battery_discharging')
    }
  }
}

// Called from the poller on both success and failure paths, before setState.
// Guards on lastUpdated so we never fire on the very first poll attempt.
export function detectGatewayTransition(newStale: boolean): void {
  const prev = getState()
  if (prev.lastUpdated === null) return
  if (!prev.stale && newStale) {
    pushEvent('gateway_stale')
  } else if (prev.stale && !newStale) {
    pushEvent('gateway_recovered')
  }
}
