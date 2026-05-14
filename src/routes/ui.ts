import type { FastifyInstance } from 'fastify'
import { lanOnly } from '../middleware/lanOnly.js'
import { getState, getEvents } from '../state/store.js'
import { loadTokens, saveTokens } from '../auth/tokens.js'
import { exchangeCodeForTokens, buildAuthorizeUrl, extractCodeFromCallbackUrl } from '../auth/flow.js'
import { getEnergySites, getSiteInfo } from '../tesla/client.js'
import { setState } from '../state/store.js'
import { readSettings, saveSettings } from '../settings.js'
import { renderSetup, renderDashboard, renderSettings } from '../ui/templates.js'
import crypto from 'crypto'

// Ephemeral in-memory state param for CSRF protection during OAuth flow
let pendingOAuthState: string | null = null

export async function uiRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', lanOnly)

  app.get('/ui', async (_req, reply) => {
    const tokens = await loadTokens()
    if (!tokens) {
      const oauthState = crypto.randomBytes(16).toString('hex')
      pendingOAuthState = oauthState
      const authorizeUrl = buildAuthorizeUrl(oauthState)
      await reply.type('text/html').send(renderSetup({ authorizeUrl }))
      return
    }
    const appState = getState()
    const settings = readSettings()
    await reply.type('text/html').send(renderDashboard({ appState, events: [...getEvents()], settings }))
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
    const socLow = parseThreshold(body['socLow'])
    const socHigh = parseThreshold(body['socHigh'])
    saveSettings({ socLow, socHigh })
    await reply.redirect('/ui')
  })

  // Receives the pasted callback URL after Tesla OAuth
  app.post('/ui/auth/connect', async (req, reply) => {
    const body = req.body as Record<string, string>
    const callbackUrl = body['callbackUrl']?.trim()

    if (!callbackUrl) {
      await reply.type('text/html').send(renderSetup({
        authorizeUrl: buildAuthorizeUrl(pendingOAuthState ?? ''),
        error: 'Please paste the callback URL from your browser.',
      }))
      return
    }

    const parsed = extractCodeFromCallbackUrl(callbackUrl)
    if (!parsed || parsed.state !== pendingOAuthState) {
      await reply.type('text/html').send(renderSetup({
        authorizeUrl: buildAuthorizeUrl(pendingOAuthState ?? ''),
        error: 'Invalid or expired callback URL. Please try again.',
      }))
      return
    }

    try {
      const tokens = await exchangeCodeForTokens(parsed.code)
      await saveTokens(tokens)
      pendingOAuthState = null

      // Auto-discover energy site
      const sites = await getEnergySites(tokens.accessToken)
      if (sites.length === 1) {
        const info = await getSiteInfo(sites[0]!.energy_site_id, tokens.accessToken)
        saveSettings({ siteId: sites[0]!.energy_site_id, siteName: info.site_name })
        setState({ authState: 'polling', siteId: sites[0]!.energy_site_id, siteName: info.site_name })
      } else if (sites.length > 1) {
        // Multiple sites — save list for picker (future enhancement; pick first for now)
        const info = await getSiteInfo(sites[0]!.energy_site_id, tokens.accessToken)
        saveSettings({ siteId: sites[0]!.energy_site_id, siteName: info.site_name })
        setState({ authState: 'polling', siteId: sites[0]!.energy_site_id, siteName: info.site_name })
      } else {
        await reply.type('text/html').send(renderSetup({
          authorizeUrl: buildAuthorizeUrl(pendingOAuthState ?? ''),
          error: 'No Powerwall energy sites found on this Tesla account.',
        }))
        return
      }

      await reply.redirect('/ui')
    } catch (err) {
      await reply.type('text/html').send(renderSetup({
        authorizeUrl: buildAuthorizeUrl(pendingOAuthState ?? ''),
        error: `Authentication failed: ${String(err)}`,
      }))
    }
  })

  app.post('/ui/auth/disconnect', async (_req, reply) => {
    const { clearTokens } = await import('../auth/tokens.js')
    await clearTokens()
    saveSettings({ siteId: null, siteName: null })
    setState({ authState: 'setup', siteId: null, siteName: null })
    await reply.redirect('/ui')
  })
}
