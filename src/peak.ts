import type { PeakScheduleEntry } from './settings.js'

// Returns true if 'now' falls within any active schedule entry.
// Month ranges that cross the year boundary (e.g. monthStart=11, monthEnd=4) are handled.
export function computeIsPeakFromSchedule(
  schedule: PeakScheduleEntry[],
  timezone: string,
  now: number = Date.now(),
): boolean {
  if (schedule.length === 0) return false
  const { hour, month } = localDateTime(timezone, now)
  return schedule.some(e => isMonthInRange(month, e.monthStart, e.monthEnd) && isHourInRange(hour, e.startHour, e.endHour))
}

// Retained for tests and potential single-window callers.
export function computeIsPeakFromWindow(
  startHour: number,
  endHour: number,
  timezone: string,
  now: number = Date.now(),
): boolean {
  const { hour } = localDateTime(timezone, now)
  return isHourInRange(hour, startHour, endHour)
}

function isHourInRange(hour: number, start: number, end: number): boolean {
  if (start === end) return false
  if (start < end) return hour >= start && hour < end
  return hour >= start || hour < end  // wraps midnight
}

function isMonthInRange(month: number, start: number, end: number): boolean {
  if (start <= end) return month >= start && month <= end
  return month >= start || month <= end  // wraps year (e.g. Nov–Apr: 11→4)
}

function localDateTime(timezone: string, now: number): { hour: number; month: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    month: 'numeric',
    hour12: false,
  }).formatToParts(new Date(now))
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10) % 24
  const month = parseInt(parts.find(p => p.type === 'month')?.value ?? '1', 10)
  return { hour, month }
}
