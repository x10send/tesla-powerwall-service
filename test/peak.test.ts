import { describe, it, expect } from 'vitest'
import { computeIsPeakFromWindow, computeIsPeakFromSchedule } from '../src/peak.js'

const TZ = 'America/Chicago'

// Helper: build a UTC timestamp for a given local Chicago time
function chicagoTs(year: number, month: number, day: number, hour: number, minute = 0): number {
  return new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`).getTime()
    + new Date(`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`).getTimezoneOffset() * 60_000
    // Use Intl to get Chicago offset precisely
    - (new Date(Date.UTC(year, month-1, day, hour, minute)).toLocaleString('en-US', { timeZone: TZ, hour12: false }).includes('24') ? 0 : 0)
}

// Simpler helper using Date and explicit UTC
function ts(isoUtc: string): number { return new Date(isoUtc).getTime() }

// Peak window: 4 PM (16) to 9 PM (21) Chicago time in summer
// In UTC: 4 PM CDT = 21:00 UTC, 9 PM CDT = 02:00 UTC next day
// We'll use known UTC timestamps

describe('computeIsPeakFromWindow', () => {
  describe('simple non-wrapping window (16–21)', () => {
    it('is peak at hour 17 (inside window)', () => {
      // 2024-07-15 17:00 Chicago CDT = 2024-07-15 22:00 UTC
      expect(computeIsPeakFromWindow(16, 21, TZ, ts('2024-07-15T22:00:00Z'))).toBe(true)
    })

    it('is peak at window start (hour 16)', () => {
      expect(computeIsPeakFromWindow(16, 21, TZ, ts('2024-07-15T21:00:00Z'))).toBe(true)
    })

    it('is not peak at window end (hour 21, exclusive)', () => {
      expect(computeIsPeakFromWindow(16, 21, TZ, ts('2024-07-16T02:00:00Z'))).toBe(false)
    })

    it('is not peak before window (hour 10)', () => {
      expect(computeIsPeakFromWindow(16, 21, TZ, ts('2024-07-15T15:00:00Z'))).toBe(false)
    })

    it('is not peak after window (hour 22)', () => {
      expect(computeIsPeakFromWindow(16, 21, TZ, ts('2024-07-16T03:00:00Z'))).toBe(false)
    })
  })

  describe('midnight-wrapping window (22–6)', () => {
    it('is peak at hour 23 (after midnight wrap start)', () => {
      expect(computeIsPeakFromWindow(22, 6, TZ, ts('2024-07-16T04:00:00Z'))).toBe(true)
    })

    it('is peak at hour 2 (early morning, inside wrapped window)', () => {
      expect(computeIsPeakFromWindow(22, 6, TZ, ts('2024-07-16T07:00:00Z'))).toBe(true)
    })

    it('is not peak at hour 12 (midday, outside wrapped window)', () => {
      expect(computeIsPeakFromWindow(22, 6, TZ, ts('2024-07-15T17:00:00Z'))).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('equal start and end means no peak period ever', () => {
      expect(computeIsPeakFromWindow(12, 12, TZ, ts('2024-07-15T17:00:00Z'))).toBe(false)
    })

    it('works with UTC timezone', () => {
      // 14:00 UTC, window 13–15 → peak
      expect(computeIsPeakFromWindow(13, 15, 'UTC', ts('2024-07-15T14:00:00Z'))).toBe(true)
    })

    it('works with Phoenix timezone (no DST)', () => {
      // Phoenix is UTC-7 always; 3 PM Phoenix = 22:00 UTC, window 14–16
      expect(computeIsPeakFromWindow(14, 16, 'America/Phoenix', ts('2024-07-15T22:00:00Z'))).toBe(true)
    })
  })
})

// SRP schedule: Nov–Apr has two windows (5–9am, 5–9pm); May–Oct has one (2–8pm)
const SRP_SCHEDULE = [
  { startHour: 5,  endHour: 9,  monthStart: 11, monthEnd: 4 },  // winter morning
  { startHour: 17, endHour: 21, monthStart: 11, monthEnd: 4 },  // winter evening
  { startHour: 14, endHour: 20, monthStart: 5,  monthEnd: 10 }, // summer afternoon
]

describe('computeIsPeakFromSchedule', () => {
  it('empty schedule is never peak', () => {
    expect(computeIsPeakFromSchedule([], 'America/Phoenix', ts('2024-07-15T22:00:00Z'))).toBe(false)
  })

  describe('summer window (May–Oct, 2–8 PM Phoenix)', () => {
    // 3 PM Phoenix = 22:00 UTC in July (UTC-7)
    it('is peak at 3 PM in July', () => {
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-07-15T22:00:00Z'))).toBe(true)
    })
    it('is not peak at 9 PM in July (after 8 PM cutoff)', () => {
      // 9 PM Phoenix = 04:00 UTC next day
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-07-16T04:00:00Z'))).toBe(false)
    })
    it('is not peak at noon in July', () => {
      // noon Phoenix = 19:00 UTC
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-07-15T19:00:00Z'))).toBe(false)
    })
  })

  describe('winter morning window (Nov–Apr, 5–9 AM Phoenix)', () => {
    // 6 AM Phoenix Jan = 13:00 UTC (UTC-7)
    it('is peak at 6 AM in January', () => {
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-01-15T13:00:00Z'))).toBe(true)
    })
    it('is not peak at 10 AM in January (after morning cutoff)', () => {
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-01-15T17:00:00Z'))).toBe(false)
    })
  })

  describe('winter evening window (Nov–Apr, 5–9 PM Phoenix)', () => {
    // 6 PM Phoenix Jan = 01:00 UTC next day (UTC-7)
    it('is peak at 6 PM in January', () => {
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-01-16T01:00:00Z'))).toBe(true)
    })
    it('is not peak at 10 PM in January (after evening cutoff)', () => {
      // 10 PM Phoenix = 05:00 UTC next day
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-01-16T05:00:00Z'))).toBe(false)
    })
  })

  describe('month boundary (Nov–Apr wraps year)', () => {
    // December should match winter windows
    it('is peak at 6 AM in December', () => {
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-12-15T13:00:00Z'))).toBe(true)
    })
    // May should match summer window, not winter
    it('is peak at 3 PM in May (summer, not winter)', () => {
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-05-15T22:00:00Z'))).toBe(true)
    })
    it('is not peak at 6 AM in May (winter window inactive)', () => {
      expect(computeIsPeakFromSchedule(SRP_SCHEDULE, 'America/Phoenix', ts('2024-05-15T13:00:00Z'))).toBe(false)
    })
  })
})

// 2024-07-15 is a Monday (UTC); in Phoenix (UTC-7) it's still Monday at 3 PM (22:00 UTC)
// 2024-07-20 is a Saturday (UTC); in Phoenix (UTC-7) it's still Saturday at 3 PM (22:00 UTC)
describe('days-of-week filtering', () => {
  const WEEKDAY_SCHEDULE = [
    { startHour: 14, endHour: 20, monthStart: 5, monthEnd: 10, days: [1, 2, 3, 4, 5] }, // Mon–Fri only
  ]

  it('is peak on a weekday within the window', () => {
    // 2024-07-15 Monday 3 PM Phoenix = 22:00 UTC
    expect(computeIsPeakFromSchedule(WEEKDAY_SCHEDULE, 'America/Phoenix', ts('2024-07-15T22:00:00Z'))).toBe(true)
  })

  it('is not peak on a Saturday within the same window', () => {
    // 2024-07-20 Saturday 3 PM Phoenix = 22:00 UTC
    expect(computeIsPeakFromSchedule(WEEKDAY_SCHEDULE, 'America/Phoenix', ts('2024-07-20T22:00:00Z'))).toBe(false)
  })

  it('is not peak on a Sunday within the same window', () => {
    // 2024-07-21 Sunday 3 PM Phoenix = 22:00 UTC
    expect(computeIsPeakFromSchedule(WEEKDAY_SCHEDULE, 'America/Phoenix', ts('2024-07-21T22:00:00Z'))).toBe(false)
  })

  it('absent days field means all days active (backwards compat)', () => {
    const allDays = [{ startHour: 14, endHour: 20, monthStart: 5, monthEnd: 10 }]
    // Saturday 3 PM Phoenix — should be peak because no days restriction
    expect(computeIsPeakFromSchedule(allDays, 'America/Phoenix', ts('2024-07-20T22:00:00Z'))).toBe(true)
  })

  it('empty days array means all days active (backwards compat)', () => {
    const allDays = [{ startHour: 14, endHour: 20, monthStart: 5, monthEnd: 10, days: [] }]
    expect(computeIsPeakFromSchedule(allDays, 'America/Phoenix', ts('2024-07-20T22:00:00Z'))).toBe(true)
  })

  it('weekend-only schedule is not peak on a weekday', () => {
    const weekendOnly = [{ startHour: 14, endHour: 20, monthStart: 5, monthEnd: 10, days: [0, 6] }]
    // Monday 3 PM Phoenix
    expect(computeIsPeakFromSchedule(weekendOnly, 'America/Phoenix', ts('2024-07-15T22:00:00Z'))).toBe(false)
  })

  it('weekend-only schedule is peak on a Saturday', () => {
    const weekendOnly = [{ startHour: 14, endHour: 20, monthStart: 5, monthEnd: 10, days: [0, 6] }]
    // Saturday 3 PM Phoenix
    expect(computeIsPeakFromSchedule(weekendOnly, 'America/Phoenix', ts('2024-07-20T22:00:00Z'))).toBe(true)
  })
})
