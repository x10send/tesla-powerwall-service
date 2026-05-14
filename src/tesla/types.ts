export interface EnergySite {
  energy_site_id: number
  resource_type: string
  display_name: string
}

export interface LiveStatus {
  solar_power: number
  battery_power: number
  load_power: number
  grid_power: number
  percentage_charged: number
  grid_status: 'Active' | 'Inactive' | string
}

export interface SiteInfo {
  id: number
  site_name: string
  timezone: string
  backup_reserve_percent: number
}

// Structure from Tesla's published example tariff JSON.
// Field names need live verification against a real account (R2).
export interface TariffPeriod {
  fromHour: number
  fromMinute: number
  toHour: number
  toMinute: number
  tariffTierCode: 'ON_PEAK' | 'OFF_PEAK' | 'PARTIAL_PEAK' | 'SUPER_OFF_PEAK' | string
}

export interface TariffSeason {
  fromMonth: number
  fromDay: number
  toMonth: number
  toDay: number
  tou_periods: {
    ON_PEAK?: TariffPeriod[]
    OFF_PEAK?: TariffPeriod[]
    PARTIAL_PEAK?: TariffPeriod[]
    SUPER_OFF_PEAK?: TariffPeriod[]
    [key: string]: TariffPeriod[] | undefined
  }
}

export interface TariffRate {
  seasons: Record<string, TariffSeason>
}
