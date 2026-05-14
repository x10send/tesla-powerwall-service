import type { TariffRate, TariffSeason } from './tesla/types.js'

// Returns true if `now` falls within an ON_PEAK or PARTIAL_PEAK window in the tariff.
// `timezone` should be an IANA tz string (e.g. "America/Chicago") matching the site.
// `now` defaults to Date.now() but is injectable for deterministic testing.
export function computeIsPeak(tariff: TariffRate, timezone: string, now: number = Date.now()): boolean {
  const season = activeSeason(tariff, timezone, now)
  if (!season) return false

  const peakTiers = ['ON_PEAK', 'PARTIAL_PEAK']
  for (const tier of peakTiers) {
    const periods = season.tou_periods[tier]
    if (periods?.some(p => periodCoversNow(p, timezone, now))) return true
  }
  return false
}

function activeSeason(tariff: TariffRate, timezone: string, now: number): TariffSeason | null {
  const { month, day } = localDate(timezone, now)
  for (const season of Object.values(tariff.seasons)) {
    if (dateInRange(month, day, season.fromMonth, season.fromDay, season.toMonth, season.toDay)) {
      return season
    }
  }
  return null
}

function periodCoversNow(
  period: { fromHour: number; fromMinute: number; toHour: number; toMinute: number },
  timezone: string,
  now: number,
): boolean {
  const { hour, minute } = localDate(timezone, now)
  const current = hour * 60 + minute
  const from = period.fromHour * 60 + period.fromMinute
  const to = period.toHour * 60 + period.toMinute

  // Handle windows that wrap midnight (e.g. 23:00–01:00)
  if (from <= to) {
    return current >= from && current < to
  }
  return current >= from || current < to
}

// Returns the month (1-12), day (1-31), hour (0-23), minute (0-59) in the given timezone.
function localDate(timezone: string, now: number): { month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(now))

  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10)
  return { month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute') }
}

// Checks if (month, day) falls within [fromMonth/fromDay, toMonth/toDay] inclusive.
// Handles ranges that wrap across year-end (e.g. Nov 1 – Mar 31).
function dateInRange(
  month: number, day: number,
  fromMonth: number, fromDay: number,
  toMonth: number, toDay: number,
): boolean {
  const current = month * 100 + day
  const from = fromMonth * 100 + fromDay
  const to = toMonth * 100 + toDay

  if (from <= to) {
    return current >= from && current <= to
  }
  // Wraps year boundary
  return current >= from || current <= to
}
