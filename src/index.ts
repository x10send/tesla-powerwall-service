import 'dotenv/config'
import { config } from './config.js'
import { createApp } from './server.js'
import { readSettings } from './settings.js'
import { setState } from './state/store.js'
import { startPoller } from './poller.js'

const app = await createApp()

const settings = readSettings()
if (settings.gatewayIp && settings.gatewayPassword) {
  setState({ authState: 'polling', siteName: settings.siteName })
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
