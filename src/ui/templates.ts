import type { PowerwallState, TransitionEvent } from '../state/store.js'
import type { Settings } from '../settings.js'

const CSS = `
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
  .card h2 { font-size: 1rem; margin: 0 0 1rem; color: #333; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .stat { background: #f5f5f5; border-radius: 6px; padding: 0.75rem; }
  .stat-label { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-value { font-size: 1.5rem; font-weight: 600; margin-top: 0.2rem; }
  .badge { display: inline-block; padding: 0.2em 0.6em; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-gray { background: #f3f4f6; color: #374151; }
  .stale-warning { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.9rem; }
  .error-box { background: #fee2e2; border: 1px solid #f87171; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.9rem; }
  input[type=text], input[type=number] { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
  button, .btn { background: #1a1a1a; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-size: 0.9rem; cursor: pointer; text-decoration: none; display: inline-block; }
  button.secondary { background: #e5e7eb; color: #1a1a1a; }
  .event-row { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
  .event-row:last-child { border-bottom: none; }
  .event-time { color: #9ca3af; }
  nav { margin-bottom: 1.5rem; }
  nav a { margin-right: 1rem; color: #6366f1; text-decoration: none; font-size: 0.9rem; }
`

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Powerwall Bridge</title>
  <style>${CSS}</style>
</head>
<body>
  <h1>Powerwall Bridge</h1>
  <p class="subtitle">Tesla Fleet API → Hubitat</p>
  ${body}
</body>
</html>`
}

export function renderSetup({ authorizeUrl, error }: { authorizeUrl: string; error?: string }): string {
  return layout('Setup', `
    ${error ? `<div class="error-box">${error}</div>` : ''}
    <div class="card">
      <h2>Connect Tesla Account</h2>
      <ol style="line-height:2">
        <li><a href="${authorizeUrl}" target="_blank" class="btn">Open Tesla Authorization</a></li>
        <li>Log in and approve access. You'll be redirected to a blank page.</li>
        <li>Copy the full URL from your browser and paste it below:</li>
      </ol>
      <form method="POST" action="/ui/auth/connect">
        <input type="text" name="callbackUrl" placeholder="https://auth.tesla.com/void/callback?code=..." style="margin-bottom:0.75rem">
        <button type="submit">Complete Setup</button>
      </form>
    </div>
  `)
}

function formatW(w: number | null): string {
  if (w === null) return '—'
  const abs = Math.abs(w)
  if (abs >= 1000) return `${(w / 1000).toFixed(1)} kW`
  return `${Math.round(w)} W`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

export function renderDashboard({
  appState,
  events,
  settings,
}: {
  appState: Readonly<PowerwallState>
  events: ReadonlyArray<TransitionEvent>
  settings: Settings
}): string {
  const gridBadge = appState.gridStatus === 'Active'
    ? '<span class="badge badge-green">Grid Connected</span>'
    : appState.gridStatus === 'Inactive'
      ? '<span class="badge badge-red">Off Grid</span>'
      : '<span class="badge badge-gray">Unknown</span>'

  const staleBanner = appState.stale
    ? `<div class="stale-warning">⚠ Data is stale — last updated ${appState.lastUpdated ? formatTime(appState.lastUpdated) : 'never'}. ${appState.lastError ?? ''}</div>`
    : ''

  const errorBanner = appState.authState === 'error'
    ? `<div class="error-box">Authentication error — <a href="/ui">reconnect Tesla account</a>. ${appState.lastError ?? ''}</div>`
    : ''

  const eventRows = events.length === 0
    ? '<p style="color:#9ca3af;font-size:0.875rem">No transitions recorded yet.</p>'
    : events.map(e =>
        `<div class="event-row"><span>${e.name}</span><span class="event-time">${new Date(e.timestamp).toLocaleString()}</span></div>`
      ).join('')

  return layout('Dashboard', `
    <nav><a href="/ui">Status</a><a href="/ui/settings">Settings</a></nav>
    ${staleBanner}${errorBanner}
    <div class="card">
      <h2>Status ${gridBadge}</h2>
      <div class="grid">
        <div class="stat"><div class="stat-label">Battery</div><div class="stat-value">${appState.soc !== null ? `${Math.round(appState.soc)}%` : '—'}</div></div>
        <div class="stat"><div class="stat-label">Solar</div><div class="stat-value">${formatW(appState.solarPower)}</div></div>
        <div class="stat"><div class="stat-label">Home</div><div class="stat-value">${formatW(appState.homePower)}</div></div>
        <div class="stat"><div class="stat-label">Grid</div><div class="stat-value">${formatW(appState.gridPower)}</div></div>
      </div>
    </div>
    <div class="card">
      <h2>Diagnostics</h2>
      <div style="font-size:0.875rem;line-height:2">
        <div>Site: <strong>${appState.siteName ?? '—'}</strong></div>
        <div>Auth state: <strong>${appState.authState}</strong></div>
        <div>Last poll: <strong>${appState.lastUpdated ? formatTime(appState.lastUpdated) : 'never'}</strong></div>
        <div>SoC thresholds: low <strong>${settings.socLow ?? 'not set'}</strong> / high <strong>${settings.socHigh ?? 'not set'}</strong></div>
      </div>
    </div>
    <div class="card">
      <h2>Recent Events</h2>
      ${eventRows}
    </div>
    <form method="POST" action="/ui/auth/disconnect" style="margin-top:1rem">
      <button class="secondary" type="submit">Disconnect Tesla Account</button>
    </form>
    <meta http-equiv="refresh" content="30">
  `)
}

export function renderSettings({ settings, saved }: { settings: Settings; saved?: boolean }): string {
  return layout('Settings', `
    <nav><a href="/ui">Status</a><a href="/ui/settings">Settings</a></nav>
    ${saved ? '<div class="card" style="background:#d1fae5;border-color:#6ee7b7">Settings saved.</div>' : ''}
    <div class="card">
      <h2>SoC Thresholds</h2>
      <form method="POST" action="/ui/settings">
        <div style="margin-bottom:1rem">
          <label style="display:block;margin-bottom:0.25rem;font-size:0.875rem">Low threshold (%) — fires <code>soc_below_threshold</code></label>
          <input type="number" name="socLow" min="0" max="100" value="${settings.socLow ?? ''}" placeholder="e.g. 20">
        </div>
        <div style="margin-bottom:1rem">
          <label style="display:block;margin-bottom:0.25rem;font-size:0.875rem">High threshold (%) — fires <code>soc_above_threshold</code></label>
          <input type="number" name="socHigh" min="0" max="100" value="${settings.socHigh ?? ''}" placeholder="e.g. 80">
        </div>
        <button type="submit">Save</button>
      </form>
    </div>
  `)
}
