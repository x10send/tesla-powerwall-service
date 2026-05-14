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
