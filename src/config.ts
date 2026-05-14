const required = (name: string): string => {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required environment variable: ${name}`)
  return val
}

export const config = {
  clientId: required('TESLA_CLIENT_ID'),
  clientSecret: required('TESLA_CLIENT_SECRET'),
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  pollIntervalMs: parseInt(process.env['POLL_INTERVAL_SECONDS'] ?? '30', 10) * 1000,
  dataDir: process.env['DATA_DIR'] ?? '/data',
  tz: process.env['TZ'] ?? 'America/Chicago',
}
