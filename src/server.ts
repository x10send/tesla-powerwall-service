import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import { apiRoutes } from './routes/api.js'
import { uiRoutes } from './routes/ui.js'

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(apiRoutes)
  await app.register(uiRoutes)
  return app
}
