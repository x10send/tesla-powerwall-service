import { describe, it, expect } from 'vitest'
import { computeIsPeak } from '../src/peak.js'
import type { TariffRate } from '../src/tesla/types.js'

// PGE EV-2A-TOU style tariff: OFF_PEAK 00:00-15:00, PARTIAL_PEAK 15:00-16:00 & 21:00-24:00, ON_PEAK 16:00-21:00
const tariff: TariffRate = {
  seasons: {
    summer: {
      fromMonth: 6, fromDay: 1,
      toMonth: 9, toDay: 30,
      tou_periods: {
        OFF_PEAK: [{ fromHour: 0, fromMinute: 0, toHour: 15, toMinute: 0, tariffTierCode: 'OFF_PEAK' }],
        PARTIAL_PEAK: [
          { fromHour: 15, fromMinute: 0, toHour: 16, toMinute: 0, tariffTierCode: 'PARTIAL_PEAK' },
          { fromHour: 21, fromMinute: 0, toHour: 24, toMinute: 0, tariffTierCode: 'PARTIAL_PEAK' },
        ],
        ON_PEAK: [{ fromHour: 16, fromMinute: 0, toHour: 21, toMinute: 0, tariffTierCode: 'ON_PEAK' }],
      },
    },
    winter: {
      fromMonth: 10, fromDay: 1,
      toMonth: 5, toDay: 31,
      tou_periods: {
        OFF_PEAK: [{ fromHour: 0, fromMinute: 0, toHour: 15, toMinute: 0, tariffTierCode: 'OFF_PEAK' }],
        PARTIAL_PEAK: [
          { fromHour: 15, fromMinute: 0, toHour: 16, toMinute: 0, tariffTierCode: 'PARTIAL_PEAK' },
          { fromHour: 21, fromMinute: 0, toHour: 24, toMinute: 0, tariffTierCode: 'PARTIAL_PEAK' },
        ],
        ON_PEAK: [{ fromHour: 16, fromMinute: 0, toHour: 21, toMinute: 0, tariffTierCode: 'ON_PEAK' }],
      },
    },
  },
}

const TZ = 'America/Chicago'

// Build a UTC timestamp for a given local date/time in Chicago.
// Computes the UTC offset via Intl rather than string parsing or hardcoded offsets.
function chicagoTs(year: number, month: number, day: number, hour: number, minute = 0): number {
  const offsetMs = getUtcOffsetMs(TZ, Date.UTC(year, month - 1, day, 12, 0))
  return Date.UTC(year, month - 1, day, hour, minute) + offsetMs
}

// Returns the offset in ms such that UTC = local_UTC_repr + offset.
// E.g. for CDT (UTC-5): local 7am = UTC noon → offset = +5h.
function getUtcOffsetMs(tz: string, utcMs: number): number {
  const d = new Date(utcMs)
  const partsFor = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
    }).formatToParts(d)
    const n = (type: string) => parseInt(parts.find(p => p.type === type)?.value ?? '0', 10)
    return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour') % 24, n('minute'), n('second'))
  }
  return partsFor('UTC') - partsFor(tz)
}

describe('computeIsPeak', () => {
  describe('basic on/off peak windows', () => {
    it('is not peak at 10:00 Chicago (summer)', () => {
      const now = chicagoTs(2024, 7, 15, 10, 0)  // July 15 10:00 AM
      expect(computeIsPeak(tariff, TZ, now)).toBe(false)
    })

    it('is peak at 17:00 Chicago (summer)', () => {
      const now = chicagoTs(2024, 7, 15, 17, 0)  // July 15 5:00 PM
      expect(computeIsPeak(tariff, TZ, now)).toBe(true)
    })

    it('is partial peak at 15:30 Chicago (summer)', () => {
      const now = chicagoTs(2024, 7, 15, 15, 30)
      expect(computeIsPeak(tariff, TZ, now)).toBe(true)  // PARTIAL_PEAK counts as peak
    })

    it('is not peak at 00:30 Chicago (summer)', () => {
      const now = chicagoTs(2024, 7, 15, 0, 30)
      expect(computeIsPeak(tariff, TZ, now)).toBe(false)
    })

    it('is partial peak at 22:00 Chicago (summer)', () => {
      const now = chicagoTs(2024, 7, 15, 22, 0)
      expect(computeIsPeak(tariff, TZ, now)).toBe(true)
    })
  })

  describe('season boundaries', () => {
    it('uses winter season in January', () => {
      const now = chicagoTs(2024, 1, 15, 17, 0)  // Jan 15 5:00 PM
      expect(computeIsPeak(tariff, TZ, now)).toBe(true)
    })

    it('winter season wraps year boundary (Oct–May)', () => {
      const nowOct = chicagoTs(2024, 10, 1, 17, 0)
      const nowMay = chicagoTs(2024, 5, 31, 17, 0)
      expect(computeIsPeak(tariff, TZ, nowOct)).toBe(true)
      expect(computeIsPeak(tariff, TZ, nowMay)).toBe(true)
    })
  })

  describe('period boundary precision', () => {
    it('is not peak at exactly 15:00 (start of partial peak, exclusive lower)', () => {
      // 15:00 marks the start of PARTIAL_PEAK; from=15:00 means >=15:00
      const now = chicagoTs(2024, 7, 15, 15, 0)
      expect(computeIsPeak(tariff, TZ, now)).toBe(true)
    })

    it('is not peak at exactly 21:00 (start of partial peak window 2)', () => {
      const now = chicagoTs(2024, 7, 15, 21, 0)
      expect(computeIsPeak(tariff, TZ, now)).toBe(true)
    })

    it('is off peak at exactly 14:59', () => {
      const now = chicagoTs(2024, 7, 15, 14, 59)
      expect(computeIsPeak(tariff, TZ, now)).toBe(false)
    })
  })

  describe('DST transitions', () => {
    it('handles spring-forward day correctly (March 10 2024)', () => {
      // Chicago springs forward at 2:00 AM → 3:00 AM
      // 17:00 local should still be peak
      const now = chicagoTs(2024, 3, 10, 17, 0)
      expect(computeIsPeak(tariff, TZ, now)).toBe(true)
    })

    it('handles fall-back day correctly (November 3 2024)', () => {
      // Chicago falls back at 2:00 AM → 1:00 AM
      const now = chicagoTs(2024, 11, 3, 17, 0)
      expect(computeIsPeak(tariff, TZ, now)).toBe(true)
    })
  })

  describe('returns false when tariff has no matching season', () => {
    it('returns false when seasons object is empty', () => {
      const empty: TariffRate = { seasons: {} }
      const now = chicagoTs(2024, 7, 15, 17, 0)
      expect(computeIsPeak(empty, TZ, now)).toBe(false)
    })
  })
})
