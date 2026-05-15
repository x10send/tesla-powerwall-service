import type { FastifyInstance } from 'fastify'
import { lanOnly } from '../middleware/lanOnly.js'
import { getState, getEvents } from '../state/store.js'
import { setState } from '../state/store.js'
import { readSettings, saveSettings } from '../settings.js'
import type { PeakScheduleEntry } from '../settings.js'
import { testConnection, clearSession, GatewayAuthError } from '../gateway/client.js'
import { triggerPoll } from '../poller.js'
import { renderSetup, renderDashboard, renderSettings } from '../ui/templates.js'

export async function uiRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', lanOnly)

  app.addHook('onSend', async (_req, reply, payload) => {
    const ct = reply.getHeader('content-type')
    if (typeof ct === 'string' && ct.startsWith('text/html')) {
      void reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'")
      void reply.header('X-Content-Type-Options', 'nosniff')
      void reply.header('X-Frame-Options', 'DENY')
    }
    return payload
  })

  app.get('/ui', async (_req, reply) => {
    const settings = readSettings()
    if (!settings.gatewayIp || !settings.gatewayPassword) {
      await reply.type('text/html').send(renderSetup({}))
      return
    }
    const appState = getState()
    await reply.type('text/html').send(
      renderDashboard({ appState, events: [...getEvents()], settings }),
    )
  })

  app.get('/ui/settings', async (_req, reply) => {
    const settings = readSettings()
    await reply.type('text/html').send(renderSettings({ settings }))
  })

  app.post('/ui/settings', async (req, reply) => {
    const body = req.body as Record<string, string>
    const parseThreshold = (v: string | undefined): number | null => {
      const n = parseFloat(v ?? '')
      return isNaN(n) ? null : Math.min(100, Math.max(0, n))
    }
    const clampHour = (n: number) => Math.min(23, Math.max(0, n))
    const clampMonth = (n: number) => Math.min(12, Math.max(1, n))

    const peakSchedule: PeakScheduleEntry[] = []
    for (let i = 0; i < 20; i++) {
      const sh = parseInt(body[`w${i}_startHour`] ?? '', 10)
      const eh = parseInt(body[`w${i}_endHour`] ?? '', 10)
      const ms = parseInt(body[`w${i}_monthStart`] ?? '', 10)
      const me = parseInt(body[`w${i}_monthEnd`] ?? '', 10)
      if (!isNaN(sh) && !isNaN(eh) && !isNaN(ms) && !isNaN(me)) {
        peakSchedule.push({ startHour: clampHour(sh), endHour: clampHour(eh), monthStart: clampMonth(ms), monthEnd: clampMonth(me) })
      }
    }

    saveSettings({
      socLow: parseThreshold(body['socLow']),
      socHigh: parseThreshold(body['socHigh']),
      peakSchedule,
    })
    await reply.redirect('/ui/settings?saved=1')
  })

  // Save gateway credentials and test connection
  app.post('/ui/gateway/connect', async (req, reply) => {
    const body = req.body as Record<string, string>
    const gatewayIp = body['gatewayIp']?.trim()
    const gatewayPassword = body['gatewayPassword']?.trim()

    if (!gatewayIp || !gatewayPassword) {
      await reply.type('text/html').send(
        renderSetup({ error: 'Gateway IP and password are required.' }),
      )
      return
    }

    try {
      await testConnection(gatewayIp, gatewayPassword)
      saveSettings({ gatewayIp, gatewayPassword })
      setState({ authState: 'polling' })
      triggerPoll(req.log)
      await reply.redirect('/ui')
    } catch (err) {
      const message = err instanceof GatewayAuthError
        ? `Could not authenticate to gateway at ${gatewayIp}. Check the IP address and password.`
        : `Connection failed: ${String(err)}`
      await reply.type('text/html').send(renderSetup({ error: message }))
    }
  })

  // Clear gateway config and return to setup
  app.post('/ui/gateway/disconnect', async (_req, reply) => {
    clearSession()
    saveSettings({ gatewayIp: null, gatewayPassword: null, siteName: null })
    setState({
      authState: 'setup',
      siteName: null,
      soc: null,
      gridStatus: null,
      solarPower: null,
      batteryPower: null,
      gridPower: null,
      homePower: null,
      isPeakPeriod: null,
      gridVoltage: null,
      gridFrequency: null,
      operationMode: null,
      backupReservePercent: null,
      solarExportedWh: null,
      gridImportedWh: null,
      gridExportedWh: null,
      batteryChargedWh: null,
      batteryDischargedWh: null,
      homeConsumedWh: null,
      nominalCapacityWh: null,
      numPowerwalls: null,
      maxDischargePowerW: null,
      maxChargePowerW: null,
      utility: null,
      stateLocation: null,
      stale: false,
      lastError: null,
    })
    await reply.redirect('/ui')
  })
}
