import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { lanOnly } from '../middleware/lanOnly.js'
import { getState, getEvents } from '../state/store.js'
import { loadTokens, saveTokens, isExpiringSoon } from '../auth/tokens.js'
import { refreshAccessToken } from '../auth/flow.js'
import { setGridMode, AuthError, CommandNotAvailableError, RateLimitError } from '../tesla/client.js'
import { readSettings } from '../settings.js'

export async function apiRoutes(app: FastifyInstance): Promise<void> {
  // Health — always 200 so Docker never restart-loops on auth failure
  app.get('/health', async (_req, reply) => {
    await reply.send({ status: 'ok' })
  })

  app.get('/status', { preHandler: lanOnly }, async (_req, reply) => {
    const state = getState()
    if (state.authState === 'setup') {
      await reply.code(503).send({ authState: 'setup', error: 'Not authenticated' })
      return
    }
    await reply.send(state)
  })

  app.get('/events', { preHandler: lanOnly }, async (_req, reply) => {
    await reply.send({ events: getEvents() })
  })

  app.post('/grid/on',  { preHandler: lanOnly }, gridHandler(true))
  app.post('/grid/off', { preHandler: lanOnly }, gridHandler(false))
}

function gridHandler(onGrid: boolean) {
  return async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const state = getState()
    if (state.authState !== 'polling') {
      await reply.code(503).send({ error: 'Not authenticated with Tesla' })
      return
    }

    const { siteId } = readSettings()
    if (!siteId) {
      await reply.code(503).send({ error: 'No site configured' })
      return
    }

    let tokens = await loadTokens()
    if (!tokens) {
      await reply.code(503).send({ error: 'No auth tokens' })
      return
    }
    if (isExpiringSoon(tokens)) {
      tokens = await refreshAccessToken(tokens.refreshToken)
      await saveTokens(tokens)
    }

    try {
      await setGridMode(siteId, onGrid, tokens.accessToken)
      await reply.send({ ok: true, mode: onGrid ? 'on-grid' : 'off-grid' })
    } catch (err) {
      if (err instanceof CommandNotAvailableError) {
        await reply.code(503).send({ error: err.message, hint: 'energy_cmds scope may not be approved for your Tesla developer app' })
      } else if (err instanceof AuthError) {
        await reply.code(401).send({ error: err.message })
      } else if (err instanceof RateLimitError) {
        await reply.code(429).send({ error: err.message })
      } else {
        await reply.code(500).send({ error: String(err) })
      }
    }
  }
}
