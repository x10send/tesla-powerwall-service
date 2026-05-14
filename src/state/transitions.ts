import { getState, pushEvent } from './store.js'
import type { LiveStatus } from '../tesla/types.js'
import { readSocThresholds } from '../settings.js'

export function detectTransitions(live: LiveStatus): void {
  const prev = getState()
  const { socLow, socHigh } = readSocThresholds()

  // Grid status transitions
  if (prev.gridStatus !== null) {
    if (prev.gridStatus !== 'Inactive' && live.grid_status === 'Inactive') {
      pushEvent('grid_lost')
    } else if (prev.gridStatus === 'Inactive' && live.grid_status === 'Active') {
      pushEvent('grid_restored')
    }
  }

  // SoC threshold transitions
  if (prev.soc !== null && socLow !== null) {
    if (prev.soc >= socLow && live.percentage_charged < socLow) {
      pushEvent('soc_below_threshold')
    } else if (prev.soc < socLow && live.percentage_charged >= socLow) {
      pushEvent('soc_above_low_threshold')
    }
  }

  if (prev.soc !== null && socHigh !== null) {
    if (prev.soc < socHigh && live.percentage_charged >= socHigh) {
      pushEvent('soc_above_threshold')
    } else if (prev.soc >= socHigh && live.percentage_charged < socHigh) {
      pushEvent('soc_below_high_threshold')
    }
  }
}
