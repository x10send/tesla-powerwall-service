import type { FastifyRequest, FastifyReply } from 'fastify'

const RFC_1918 = [
  /^10\.\d+\.\d+\.\d+$/,
  /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
  /^192\.168\.\d+\.\d+$/,
]

const LOOPBACK = /^127\.\d+\.\d+\.\d+$/

export function isLanIp(ip: string): boolean {
  const stripped = ip.startsWith('::ffff:') ? ip.slice(7) : ip
  if (stripped === '::1') return true
  return LOOPBACK.test(stripped) || RFC_1918.some(r => r.test(stripped))
}

export async function lanOnly(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const ip = request.ip
  if (!isLanIp(ip)) {
    await reply.code(403).send({ error: 'Access restricted to local network' })
  }
}
