import { config } from './config.js'
import { loadTokens, saveTokens, isExpiringSoon } from './auth/tokens.js'
import { refreshAccessToken } from './auth/flow.js'
import { getLiveStatus, getTariffRate, AuthError, RateLimitError } from './tesla/client.js'
import { setState } from './state/store.js'
import { detectTransitions } from './state/transitions.js'
import { readSettings } from './settings.js'
import { computeIsPeak } from './peak.js'
import type { TariffRate } from './tesla/types.js'
import type { FastifyBaseLogger } from 'fastify'

let timer: ReturnType<typeof setTimeout> | null = null

// Tariff is refreshed once per hour — it rarely changes
let cachedTariff: TariffRate | null = null
let tariffFetchedAt = 0
const TARIFF_TTL_MS = 60 * 60 * 1000

export function startPoller(log: FastifyBaseLogger): void {
  scheduleNext(log)
}

export function stopPoller(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

function scheduleNext(log: FastifyBaseLogger): void {
  timer = setTimeout(() => poll(log), config.pollIntervalMs)
}

async function poll(log: FastifyBaseLogger): Promise<void> {
  try {
    const { siteId } = readSettings()
    if (!siteId) {
      scheduleNext(log)
      return
    }

    let tokens = await loadTokens()
    if (!tokens) {
      setState({ authState: 'setup' })
      scheduleNext(log)
      return
    }

    if (isExpiringSoon(tokens)) {
      log.info('Access token expiring soon, refreshing')
      try {
        tokens = await refreshAccessToken(tokens.refreshToken)
        await saveTokens(tokens)
      } catch (err) {
        log.error({ err }, 'Token refresh failed')
        setState({ authState: 'error', lastError: String(err) })
        scheduleNext(log)
        return
      }
    }

    // Refresh tariff cache once per hour
    if (!cachedTariff || Date.now() - tariffFetchedAt > TARIFF_TTL_MS) {
      try {
        cachedTariff = await getTariffRate(siteId, tokens.accessToken)
        tariffFetchedAt = Date.now()
        if (!cachedTariff) log.info('Tariff rate endpoint returned no data — peak detection disabled')
      } catch (err) {
        log.warn({ err }, 'Failed to fetch tariff rate — peak detection unavailable')
      }
    }

    const live = await getLiveStatus(siteId, tokens.accessToken)

    const isPeakPeriod = cachedTariff
      ? computeIsPeak(cachedTariff, config.tz)
      : null

    detectTransitions(live, isPeakPeriod)

    setState({
      authState: 'polling',
      solarPower: live.solar_power,
      batteryPower: live.battery_power,
      gridPower: live.grid_power,
      homePower: live.load_power,
      soc: live.percentage_charged,
      gridStatus: live.grid_status,
      isPeakPeriod,
      stale: false,
      lastUpdated: Date.now(),
      lastError: null,
    })

    log.debug({ soc: live.percentage_charged, gridStatus: live.grid_status, isPeakPeriod }, 'Poll successful')
  } catch (err) {
    if (err instanceof AuthError) {
      log.warn('Auth error during poll — switching to setup mode')
      setState({ authState: 'error', stale: true, lastError: String(err) })
    } else if (err instanceof RateLimitError) {
      log.warn('Rate limited by Tesla API — will retry next interval')
      setState({ stale: true, lastError: String(err) })
    } else {
      log.error({ err }, 'Poll failed')
      setState({ stale: true, lastError: String(err) })
    }
  }

  scheduleNext(log)
}
