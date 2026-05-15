import { config } from './config.js'
import { readSettings, saveSettings } from './settings.js'
import { pollGateway, fetchSystemInfo, GatewayAuthError } from './gateway/client.js'
import { setState } from './state/store.js'
import { detectTransitions } from './state/transitions.js'
import { computeIsPeakFromSchedule } from './peak.js'
import type { FastifyBaseLogger } from 'fastify'

let timer: ReturnType<typeof setTimeout> | null = null

// System info is fetched once at startup and refreshed hourly (changes rarely)
let systemInfoFetchedAt = 0
const SYSTEM_INFO_TTL = 60 * 60 * 1000

export function startPoller(log: FastifyBaseLogger): void {
  void poll(log)
}

export function stopPoller(): void {
  if (timer) { clearTimeout(timer); timer = null }
}

// Cancel pending timer and run a poll immediately (e.g. after gateway connect)
export function triggerPoll(log: FastifyBaseLogger): void {
  if (timer) { clearTimeout(timer); timer = null }
  void poll(log)
}

function scheduleNext(log: FastifyBaseLogger): void {
  timer = setTimeout(() => poll(log), config.pollIntervalMs)
}

async function poll(log: FastifyBaseLogger): Promise<void> {
  try {
    const settings = readSettings()

    if (!settings.gatewayIp || !settings.gatewayPassword) {
      setState({ authState: 'setup' })
      scheduleNext(log)
      return
    }

    const { gatewayIp, gatewayPassword } = settings

    // Refresh system info hourly (site name, capacity, utility, etc.)
    if (Date.now() - systemInfoFetchedAt > SYSTEM_INFO_TTL) {
      try {
        const info = await fetchSystemInfo(gatewayIp, gatewayPassword)
        systemInfoFetchedAt = Date.now()
        if (info.siteName && info.siteName !== settings.siteName) {
          saveSettings({ siteName: info.siteName })
        }
        setState({
          siteName: info.siteName || settings.siteName,
          nominalCapacityWh: info.nominalCapacityWh,
          numPowerwalls: info.numPowerwalls,
          maxDischargePowerW: info.maxDischargePowerW,
          maxChargePowerW: info.maxChargePowerW,
          utility: info.utility,
          stateLocation: info.stateLocation,
          units: info.units,
        })
      } catch (err) {
        log.warn({ err }, 'Failed to fetch system info — will retry next hour')
      }
    }

    const data = await pollGateway(gatewayIp, gatewayPassword)

    const isPeakPeriod = settings.peakSchedule.length > 0
      ? computeIsPeakFromSchedule(settings.peakSchedule, config.tz)
      : null

    detectTransitions(data, isPeakPeriod)

    setState({
      authState: 'polling',
      soc: data.soc,
      gridStatus: data.gridStatus,
      solarPower: data.solarPower,
      batteryPower: data.batteryPower,
      gridPower: data.gridPower,
      homePower: data.homePower,
      isPeakPeriod,
      gridVoltage: data.gridVoltage,
      gridFrequency: data.gridFrequency,
      operationMode: data.operationMode,
      backupReservePercent: data.backupReservePercent,
      solarExportedWh: data.solarExportedWh,
      gridImportedWh: data.gridImportedWh,
      gridExportedWh: data.gridExportedWh,
      batteryChargedWh: data.batteryChargedWh,
      batteryDischargedWh: data.batteryDischargedWh,
      homeConsumedWh: data.homeConsumedWh,
      stale: false,
      lastUpdated: Date.now(),
      lastError: null,
    })

    log.debug({ soc: data.soc, gridStatus: data.gridStatus, isPeakPeriod }, 'Poll OK')
  } catch (err) {
    if (err instanceof GatewayAuthError) {
      log.warn({ err }, 'Gateway auth error — will retry')
      setState({ authState: 'error', stale: true, lastError: String(err) })
    } else {
      log.error({ err }, 'Poll failed')
      setState({ stale: true, lastError: String(err) })
    }
  }

  scheduleNext(log)
}
