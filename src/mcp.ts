import { randomUUID } from 'node:crypto'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { getState, getEvents } from './state/store.js'
import { setGatewayGridMode, GatewayAuthError } from './gateway/client.js'
import { readSettings } from './settings.js'
import { lanOnly } from './middleware/lanOnly.js'

const MAX_SESSIONS = 20

function buildMcpServer(): McpServer {
  const server = new McpServer({ name: 'powerwall-bridge', version: '1.0.0' })

  server.tool(
    'get_powerwall_status',
    'Get the current Powerwall state: state of charge, grid status, real-time power flows (solar/battery/grid/home in watts), lifetime energy totals (Wh), and system information.',
    {},
    async () => {
      const state = getState()
      return { content: [{ type: 'text' as const, text: JSON.stringify(state, null, 2) }] }
    }
  )

  server.tool(
    'get_recent_events',
    'Get the most recent Powerwall state-transition events (grid outages, charging state changes, etc.) in reverse-chronological order.',
    { limit: z.number().int().min(1).max(50).default(10).optional().describe('Maximum number of events to return (default 10, max 50)') },
    async ({ limit = 10 }) => {
      const events = getEvents().slice(0, limit)
      return { content: [{ type: 'text' as const, text: JSON.stringify(events, null, 2) }] }
    }
  )

  server.tool(
    'set_grid_mode',
    'Set the Powerwall grid connection mode. WARNING: this is a physical operation that affects grid connectivity. "on" reconnects to the utility grid; "off" islands the system to battery-only backup. Confirm intent explicitly before calling.',
    { mode: z.enum(['on', 'off']).describe('"on" = connected to utility grid | "off" = islanded / battery-only') },
    async ({ mode }) => {
      const settings = readSettings()
      if (!settings.gatewayIp || !settings.gatewayPassword) {
        return { isError: true, content: [{ type: 'text' as const, text: 'Gateway not configured' }] }
      }
      try {
        await setGatewayGridMode(settings.gatewayIp, settings.gatewayPassword, mode === 'on')
        return { content: [{ type: 'text' as const, text: `Grid mode set to ${mode === 'on' ? 'on-grid' : 'islanded'}` }] }
      } catch (err) {
        const msg = err instanceof GatewayAuthError
          ? 'Gateway authentication failed'
          : 'Grid mode command failed'
        return { isError: true, content: [{ type: 'text' as const, text: msg }] }
      }
    }
  )

  return server
}

async function relayToTransport(
  transport: StreamableHTTPServerTransport,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  reply.hijack()
  try {
    await transport.handleRequest(request.raw, reply.raw, request.body)
  } catch {
    if (!reply.raw.headersSent) reply.raw.writeHead(500, { 'Content-Type': 'application/json' })
    reply.raw.end(JSON.stringify({ error: 'Internal server error' }))
  }
}

export async function mcpRoutes(app: FastifyInstance): Promise<void> {
  const sessions = new Map<string, StreamableHTTPServerTransport>()

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: '/mcp',
    preHandler: lanOnly,
    handler: async (request, reply) => {
      const sessionId = request.headers['mcp-session-id'] as string | undefined

      if (request.method === 'POST' && !sessionId) {
        if (sessions.size >= MAX_SESSIONS) {
          await reply.code(503).send({ error: 'Too many active sessions' })
          return
        }
        let assignedId: string | undefined
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            assignedId = id
            sessions.set(id, transport)
          },
        })
        transport.onclose = () => {
          if (assignedId) sessions.delete(assignedId)
        }
        await buildMcpServer().connect(transport)
        await relayToTransport(transport, request, reply)
        return
      }

      if (!sessionId) {
        await reply.code(400).send({ error: 'Missing Mcp-Session-Id header' })
        return
      }
      const transport = sessions.get(sessionId)
      if (!transport) {
        await reply.code(404).send({ error: 'Session not found' })
        return
      }
      await relayToTransport(transport, request, reply)
    },
  })
}
