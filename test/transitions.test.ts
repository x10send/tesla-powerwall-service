import { describe, it, expect, beforeEach } from 'vitest'
import { detectTransitions } from '../src/state/transitions.js'
import { setState, getEvents, clearEvents } from '../src/state/store.js'
import { saveSettings } from '../src/settings.js'
import type { LiveStatus } from '../src/tesla/types.js'

const baseLive: LiveStatus = {
  solar_power: 2000,
  battery_power: -200,
  load_power: 1800,
  grid_power: 0,
  percentage_charged: 80,
  grid_status: 'Active',
}

beforeEach(() => {
  setState({
    authState: 'polling',
    siteId: 1,
    siteName: 'Test',
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
  })
  clearEvents()
  saveSettings({ socLow: null, socHigh: null })
})

// ── Grid status ────────────────────────────────────────────────────────────

describe('grid transitions', () => {
  it('fires grid_lost when grid goes from Active to Inactive', () => {
    setState({ gridStatus: 'Active' })
    detectTransitions({ ...baseLive, grid_status: 'Inactive' }, null)
    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('grid_lost')
    expect(typeof events[0].timestamp).toBe('number')
  })

  it('fires grid_restored when grid goes from Inactive to Active', () => {
    setState({ gridStatus: 'Inactive' })
    detectTransitions({ ...baseLive, grid_status: 'Active' }, null)
    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('grid_restored')
  })

  it('fires no event when grid stays Active', () => {
    setState({ gridStatus: 'Active' })
    detectTransitions({ ...baseLive, grid_status: 'Active' }, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event when grid stays Inactive', () => {
    setState({ gridStatus: 'Inactive' })
    detectTransitions({ ...baseLive, grid_status: 'Inactive' }, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event on first poll (prev gridStatus null)', () => {
    setState({ gridStatus: null })
    detectTransitions({ ...baseLive, grid_status: 'Inactive' }, null)
    expect(getEvents()).toHaveLength(0)
  })
})

// ── SoC low threshold ──────────────────────────────────────────────────────

describe('SoC low threshold transitions', () => {
  it('fires soc_below_threshold when SoC drops below socLow', () => {
    setState({ soc: 25 })
    saveSettings({ socLow: 20 })
    detectTransitions({ ...baseLive, percentage_charged: 18 }, null)
    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('soc_below_threshold')
  })

  it('fires soc_above_low_threshold when SoC rises back above socLow', () => {
    setState({ soc: 15 })
    saveSettings({ socLow: 20 })
    detectTransitions({ ...baseLive, percentage_charged: 22 }, null)
    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('soc_above_low_threshold')
  })

  it('fires no event when SoC stays above socLow', () => {
    setState({ soc: 50 })
    saveSettings({ socLow: 20 })
    detectTransitions({ ...baseLive, percentage_charged: 45 }, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event when SoC stays below socLow', () => {
    setState({ soc: 10 })
    saveSettings({ socLow: 20 })
    detectTransitions({ ...baseLive, percentage_charged: 12 }, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event on first poll (prev soc null)', () => {
    setState({ soc: null })
    saveSettings({ socLow: 20 })
    detectTransitions({ ...baseLive, percentage_charged: 10 }, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event when socLow is not configured', () => {
    setState({ soc: 25 })
    saveSettings({ socLow: null })
    detectTransitions({ ...baseLive, percentage_charged: 10 }, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires at the exact threshold boundary (prev at threshold, current just below)', () => {
    setState({ soc: 20 })
    saveSettings({ socLow: 20 })
    detectTransitions({ ...baseLive, percentage_charged: 19 }, null)
    expect(getEvents()[0]?.name).toBe('soc_below_threshold')
  })

  it('fires no event when prev equals threshold and current equals threshold', () => {
    setState({ soc: 20 })
    saveSettings({ socLow: 20 })
    detectTransitions({ ...baseLive, percentage_charged: 20 }, null)
    expect(getEvents()).toHaveLength(0)
  })
})

// ── SoC high threshold ─────────────────────────────────────────────────────

describe('SoC high threshold transitions', () => {
  it('fires soc_above_threshold when SoC rises above socHigh', () => {
    setState({ soc: 85 })
    saveSettings({ socHigh: 90 })
    detectTransitions({ ...baseLive, percentage_charged: 92 }, null)
    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('soc_above_threshold')
  })

  it('fires soc_below_high_threshold when SoC drops back below socHigh', () => {
    setState({ soc: 95 })
    saveSettings({ socHigh: 90 })
    detectTransitions({ ...baseLive, percentage_charged: 88 }, null)
    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('soc_below_high_threshold')
  })

  it('fires no event when SoC stays above socHigh', () => {
    setState({ soc: 95 })
    saveSettings({ socHigh: 90 })
    detectTransitions({ ...baseLive, percentage_charged: 93 }, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event when SoC stays below socHigh', () => {
    setState({ soc: 50 })
    saveSettings({ socHigh: 90 })
    detectTransitions({ ...baseLive, percentage_charged: 60 }, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event when socHigh is not configured', () => {
    setState({ soc: 85 })
    saveSettings({ socHigh: null })
    detectTransitions({ ...baseLive, percentage_charged: 95 }, null)
    expect(getEvents()).toHaveLength(0)
  })
})

// ── Peak period ────────────────────────────────────────────────────────────

describe('peak period transitions', () => {
  it('fires peak_start when entering peak period', () => {
    setState({ isPeakPeriod: false })
    detectTransitions(baseLive, true)
    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('peak_start')
  })

  it('fires peak_end when leaving peak period', () => {
    setState({ isPeakPeriod: true })
    detectTransitions(baseLive, false)
    const events = getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('peak_end')
  })

  it('fires no event when staying in peak period', () => {
    setState({ isPeakPeriod: true })
    detectTransitions(baseLive, true)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event when staying off-peak', () => {
    setState({ isPeakPeriod: false })
    detectTransitions(baseLive, false)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event when isPeakPeriod arg is null (no tariff data)', () => {
    setState({ isPeakPeriod: false })
    detectTransitions(baseLive, null)
    expect(getEvents()).toHaveLength(0)
  })

  it('fires no event on first tariff data (prev isPeakPeriod null)', () => {
    setState({ isPeakPeriod: null })
    detectTransitions(baseLive, true)
    expect(getEvents()).toHaveLength(0)
  })
})

// ── Multiple simultaneous transitions ─────────────────────────────────────

describe('multiple transitions in one poll', () => {
  it('fires both grid_lost and soc_below_threshold in the same call', () => {
    setState({ gridStatus: 'Active', soc: 25 })
    saveSettings({ socLow: 20 })
    detectTransitions({ ...baseLive, grid_status: 'Inactive', percentage_charged: 15 }, null)
    const names = getEvents().map(e => e.name)
    expect(names).toContain('grid_lost')
    expect(names).toContain('soc_below_threshold')
    expect(names).toHaveLength(2)
  })

  it('fires both peak_start and soc_above_threshold in the same call', () => {
    setState({ isPeakPeriod: false, soc: 85 })
    saveSettings({ socHigh: 90 })
    detectTransitions({ ...baseLive, percentage_charged: 92 }, true)
    const names = getEvents().map(e => e.name)
    expect(names).toContain('peak_start')
    expect(names).toContain('soc_above_threshold')
    expect(names).toHaveLength(2)
  })
})
