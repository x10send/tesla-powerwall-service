import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { config } from './config.js'

export interface PeakScheduleEntry {
  startHour: number    // 0-23
  endHour: number      // 0-23, exclusive upper bound
  monthStart: number   // 1-12
  monthEnd: number     // 1-12 (monthStart > monthEnd means wraps year, e.g. Nov–Apr)
}

export interface Settings {
  gatewayIp: string | null
  gatewayPassword: string | null
  siteName: string | null
  socLow: number | null     // fire soc_below_threshold when SoC drops below this
  socHigh: number | null    // fire soc_above_threshold when SoC rises above this
  peakSchedule: PeakScheduleEntry[]
}

const settingsPath = () => join(config.dataDir, 'config.json')

const defaults: Settings = {
  gatewayIp: null,
  gatewayPassword: null,
  siteName: null,
  socLow: null,
  socHigh: null,
  peakSchedule: [],
}

function load(): Settings {
  try {
    return { ...defaults, ...JSON.parse(readFileSync(settingsPath(), 'utf-8')) as Partial<Settings> }
  } catch {
    return { ...defaults }
  }
}

export function readSettings(): Settings {
  return load()
}

export function readSocThresholds(): { socLow: number | null; socHigh: number | null } {
  const s = load()
  return { socLow: s.socLow, socHigh: s.socHigh }
}

export function saveSettings(patch: Partial<Settings>): void {
  mkdirSync(config.dataDir, { recursive: true })
  const current = load()
  writeFileSync(settingsPath(), JSON.stringify({ ...current, ...patch }, null, 2), 'utf-8')
}
