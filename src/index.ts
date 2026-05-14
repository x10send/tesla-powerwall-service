import { config } from './config.js'
import { createApp } from './server.js'
import { loadTokens } from './auth/tokens.js'
import { readSettings } from './settings.js'
import { setState } from './state/store.js'
import { startPoller } from './poller.js'

const app = await createApp()

// Restore state from persisted settings on startup
const tokens = await loadTokens()
const settings = readSettings()
if (tokens && settings.siteId) {
  setState({
    authState: 'polling',
    siteId: settings.siteId,
    siteName: settings.siteName,
  })
} else {
  setState({ authState: 'setup' })
}

startPoller(app.log)

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
