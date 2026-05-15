import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { lanOnly } from '../middleware/lanOnly.js'
import { getState, getEvents } from '../state/store.js'
import { setGatewayGridMode, GatewayAuthError } from '../gateway/client.js'
import { readSettings } from '../settings.js'

export async function apiRoutes(app: FastifyInstance): Promise<void> {
  // Health — always 200; Docker healthcheck must never restart the container due to auth state
  app.get('/health', async (_req, reply) => {
    await reply.send({ status: 'ok' })
  })

  app.get('/status', { preHandler: lanOnly }, async (_req, reply) => {
    const state = getState()
    if (state.authState === 'setup') {
      await reply.code(503).send({ authState: 'setup', error: 'Gateway not configured' })
      return
    }
    await reply.send({ ...state, events: getEvents() })
  })

  app.get('/events', { preHandler: lanOnly }, async (_req, reply) => {
    await reply.send({ events: getEvents() })
  })

  app.post('/grid/on',  { preHandler: lanOnly }, gridHandler(true))
  app.post('/grid/off', { preHandler: lanOnly }, gridHandler(false))
}

function gridHandler(onGrid: boolean) {
  return async (_req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const settings = readSettings()
    if (!settings.gatewayIp || !settings.gatewayPassword) {
      await reply.code(503).send({ error: 'Gateway not configured' })
      return
    }

    try {
      await setGatewayGridMode(settings.gatewayIp, settings.gatewayPassword, onGrid)
      await reply.send({ ok: true, mode: onGrid ? 'on-grid' : 'off-grid' })
    } catch (err) {
      if (err instanceof GatewayAuthError) {
        await reply.code(401).send({ error: err.message })
      } else {
        await reply.code(500).send({ error: 'Grid mode command failed' })
      }
    }
  }
}
