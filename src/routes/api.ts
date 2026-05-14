import type { FastifyInstance } from 'fastify'
import { lanOnly } from '../middleware/lanOnly.js'
import { getState, getEvents } from '../state/store.js'

export async function apiRoutes(app: FastifyInstance): Promise<void> {
  // Health endpoint — always 200, even in setup/error state, so Docker never restart-loops
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
}
