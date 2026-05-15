export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  pollIntervalMs: parseInt(process.env['POLL_INTERVAL_SECONDS'] ?? '30', 10) * 1000,
  dataDir: process.env['DATA_DIR'] ?? '/data',
  tz: process.env['TZ'] ?? 'America/Chicago',
}
