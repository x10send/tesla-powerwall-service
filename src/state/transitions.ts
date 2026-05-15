import { getState, pushEvent } from './store.js'
import type { GatewayData } from '../gateway/client.js'
import { readSocThresholds } from '../settings.js'

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
}
