import type { PowerwallState, TransitionEvent, PowerwallUnit } from '../state/store.js'
import type { Settings, PeakScheduleEntry } from '../settings.js'

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

const CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{
  --bg:#f8fafc;--surface:#ffffff;--surface-2:#f1f5f9;
  --border:#e2e8f0;--border-2:#cbd5e1;
  --text:#0f172a;--text-2:#475569;--muted:#64748b;
  --accent:#2563eb;--accent-h:#1d4ed8;--accent-t:color-mix(in srgb,#2563eb 12%,transparent);
  --success:#059669;--success-t:color-mix(in srgb,#059669 12%,transparent);
  --warning:#d97706;--warning-t:color-mix(in srgb,#d97706 12%,transparent);
  --danger:#dc2626;--danger-h:#b91c1c;--danger-t:color-mix(in srgb,#dc2626 12%,transparent);
  --shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.05);
  --radius:8px;
}
@media(prefers-color-scheme:dark){:root{
  --bg:#0f172a;--surface:#1e293b;--surface-2:#0f172a;
  --border:#334155;--border-2:#475569;
  --text:#f1f5f9;--text-2:#cbd5e1;--muted:#94a3b8;
  --accent:#3b82f6;--accent-h:#60a5fa;--accent-t:color-mix(in srgb,#3b82f6 15%,transparent);
  --success:#10b981;--success-t:color-mix(in srgb,#10b981 15%,transparent);
  --warning:#f59e0b;--warning-t:color-mix(in srgb,#f59e0b 15%,transparent);
  --danger:#ef4444;--danger-h:#f87171;--danger-t:color-mix(in srgb,#ef4444 15%,transparent);
  --shadow:0 1px 3px rgba(0,0,0,.4),0 1px 2px rgba(0,0,0,.3);
}}
body{margin:0;background:var(--bg);color:var(--text);font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.5}
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}
code{font-family:ui-monospace,monospace;font-size:.85em;background:var(--surface-2);padding:.1em .35em;border-radius:3px}
/* App shell */
.app-header{background:var(--surface);border-bottom:1px solid var(--border);padding:0 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;height:52px;position:sticky;top:0;z-index:10;box-shadow:var(--shadow)}
.app-logo{font-size:.95rem;font-weight:700;color:var(--accent);letter-spacing:-.01em;display:flex;align-items:center;gap:.5rem}
.app-logo-sub{opacity:.6;font-weight:400;font-size:.8rem;color:var(--muted)}
.app-nav{display:flex;gap:.25rem}
.nav-link{padding:.35rem .75rem;border-radius:6px;font-size:.875rem;color:var(--text-2);transition:background .1s,color .1s}
.nav-link:hover{background:var(--surface-2);color:var(--text);text-decoration:none}
.nav-link.active{background:var(--accent-t);color:var(--accent);font-weight:600}
.app-main{max-width:860px;margin:0 auto;padding:1.75rem 1.25rem}
/* Cards */
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:1.25rem;box-shadow:var(--shadow);margin-bottom:1rem}
.card-title{font-size:.95rem;font-weight:600;margin:0 0 1rem;color:var(--text);display:flex;align-items:center;gap:.6rem}
/* Stat grid */
.stat-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.75rem;margin-bottom:1rem}
.stat{background:var(--surface-2);border:1px solid var(--border);border-radius:6px;padding:.9rem 1rem}
.stat-label{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem}
.stat-value{font-size:1.5rem;font-weight:700;color:var(--text);line-height:1.1}
.stat-sub{font-size:.75rem;color:var(--muted);margin-top:.3rem}
/* Battery bar */
.battery-wrap{margin-top:.5rem}
.battery-bar-bg{height:6px;background:var(--border);border-radius:3px;overflow:hidden}
.battery-bar-fill{height:100%;border-radius:3px;transition:width .4s}
/* Badges */
.badge{display:inline-flex;align-items:center;padding:.15rem .5rem;border-radius:99px;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.badge-success{background:var(--success-t);color:var(--success)}
.badge-warning{background:var(--warning-t);color:var(--warning)}
.badge-danger{background:var(--danger-t);color:var(--danger)}
.badge-muted{background:var(--surface-2);color:var(--muted)}
.badge-accent{background:var(--accent-t);color:var(--accent)}
/* Alerts */
.alert{padding:.75rem 1rem;border-radius:var(--radius);border-left:4px solid;margin-bottom:1rem;font-size:.875rem}
.alert-warning{background:var(--warning-t);border-color:var(--warning)}
.alert-danger{background:var(--danger-t);border-color:var(--danger)}
.alert-success{background:var(--success-t);border-color:var(--success)}
/* Rows */
.row{display:flex;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--border);font-size:.875rem}
.row:last-child{border-bottom:none}
.row-label{color:var(--muted)}
/* Events */
.event-row{display:flex;justify-content:space-between;align-items:center;padding:.45rem 0;border-bottom:1px solid var(--border);font-size:.875rem}
.event-row:last-child{border-bottom:none}
.event-time{color:var(--muted);font-size:.8rem}
/* Buttons */
.btn{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem 1rem;border-radius:6px;font-size:.875rem;font-weight:500;cursor:pointer;border:1px solid transparent;text-decoration:none;transition:background .15s,border-color .15s,color .15s;line-height:1.4}
.btn:hover{text-decoration:none}
.btn-primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.btn-primary:hover{background:var(--accent-h);border-color:var(--accent-h)}
.btn-secondary{background:transparent;border-color:var(--border-2);color:var(--text-2)}
.btn-secondary:hover{background:var(--surface-2);color:var(--text)}
.btn-danger{background:var(--danger);color:#fff;border-color:var(--danger)}
.btn-danger:hover{background:var(--danger-h);border-color:var(--danger-h)}
.btn-danger-outline{background:transparent;border-color:var(--danger);color:var(--danger)}
.btn-danger-outline:hover{background:var(--danger);color:#fff}
.btn-sm{padding:.25rem .6rem;font-size:.8rem}
/* Forms */
.form-group{margin-bottom:1rem}
.form-label{display:block;font-size:.875rem;font-weight:500;margin-bottom:.35rem}
.form-input{display:block;width:100%;padding:.5rem .75rem;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:.875rem;transition:border-color .15s,outline .15s}
.form-input:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent)}
.form-hint{font-size:.75rem;color:var(--muted);margin-top:.3rem}
/* Two-col */
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:.75rem}
/* Unit rows */
.unit-section{margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border)}
.unit-section-label{font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem}
/* Peak schedule */
.peak-row{border:1px solid var(--border);border-radius:6px;padding:.75rem;margin-bottom:.5rem;background:var(--surface-2)}
.peak-row-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:.5rem;margin-bottom:.4rem;align-items:center}
.peak-input{padding:.4rem .5rem;border:1px solid var(--border);border-radius:4px;font-size:.875rem;background:var(--surface);color:var(--text);width:100%}
.day-boxes{display:flex;gap:.6rem;flex-wrap:wrap;align-items:center}
.day-label{display:flex;align-items:center;gap:.25rem;cursor:pointer;font-size:.8rem;color:var(--text-2)}
/* Utils */
.text-muted{color:var(--muted)}
.text-success{color:var(--success)}
.text-danger{color:var(--danger)}
.empty-state{color:var(--muted);font-size:.875rem;padding:.5rem 0}
hr{border:none;border-top:1px solid var(--border);margin:1.25rem 0}
`

function layout(title: string, nav: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Powerwall Bridge</title>
  <style>${CSS}</style>
</head>
<body>
  <header class="app-header">
    <div class="app-logo">⚡ Powerwall Bridge <span class="app-logo-sub">Local Gateway → Hubitat</span></div>
    <nav class="app-nav">${nav}</nav>
  </header>
  <main class="app-main">
    ${body}
  </main>
</body>
</html>`
}

function dashNav(active: 'status' | 'settings'): string {
  return [
    `<a href="/ui" class="nav-link${active === 'status' ? ' active' : ''}">Status</a>`,
    `<a href="/ui/settings" class="nav-link${active === 'settings' ? ' active' : ''}">Settings</a>`,
  ].join('')
}

// ── Format helpers ─────────────────────────────────────────────────────────────

function formatW(w: number | null): string {
  if (w === null) return '—'
  const abs = Math.abs(w)
  if (abs >= 1000) return `${(w / 1000).toFixed(1)} kW`
  return `${Math.round(w)} W`
}

function formatWh(wh: number | null): string {
  if (wh === null) return '—'
  if (wh >= 1_000_000) return `${(wh / 1_000_000).toFixed(1)} MWh`
  if (wh >= 1_000) return `${(wh / 1_000).toFixed(1)} kWh`
  return `${Math.round(wh)} Wh`
}

function formatKwh(wh: number | null): string {
  if (wh === null) return '—'
  return `${(wh / 1000).toFixed(1)} kWh`
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString()
}

function formatOperationMode(mode: string | null): string {
  switch (mode) {
    case 'autonomous':        return 'Self-Powered'
    case 'backup':            return 'Backup Only'
    case 'self_consumption':  return 'Self-Powered'
    case 'time_of_use':       return 'Time-Based Control'
    default:                  return mode ?? '—'
  }
}

function hourLabel(h: number | null): string {
  if (h === null) return 'not set'
  const suffix = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 === 0 ? 12 : h % 12
  return `${display}:00 ${suffix}`
}

function batteryBarColor(soc: number): string {
  if (soc <= 15) return 'var(--danger)'
  if (soc <= 30) return 'var(--warning)'
  return 'var(--success)'
}

// ── Setup page ─────────────────────────────────────────────────────────────────

export function renderSetup({ error }: { error?: string } = {}): string {
  const body = `
    ${error ? `<div class="alert alert-danger">${esc(error)}</div>` : ''}
    <div class="card">
      <div class="card-title">Connect Powerwall Gateway</div>
      <p style="font-size:.875rem;color:var(--muted);margin:0 0 1.25rem">
        Enter the IP address and password for your Powerwall gateway.
        Find the password on the label on the back of the gateway unit,
        or in the Tesla app under Powerwall → Settings → Advanced.
      </p>
      <form method="POST" action="/ui/gateway/connect">
        <div class="form-group">
          <label class="form-label" for="ip">Gateway IP Address</label>
          <input class="form-input" type="text" id="ip" name="gatewayIp" placeholder="e.g. 192.168.1.x" required autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label" for="pw">Gateway Password</label>
          <input class="form-input" type="password" id="pw" name="gatewayPassword" placeholder="Password from gateway label" required autocomplete="off">
          <p class="form-hint">Stored in config.json on your Docker volume — not sent to Tesla.</p>
        </div>
        <button class="btn btn-primary" type="submit">Connect</button>
      </form>
    </div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Setup — Powerwall Bridge</title>
  <style>${CSS}</style>
</head>
<body>
  <header class="app-header">
    <div class="app-logo">⚡ Powerwall Bridge</div>
  </header>
  <main class="app-main">
    ${body}
  </main>
</body>
</html>`
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

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
    ? '<span class="badge badge-success">Grid Connected</span>'
    : appState.gridStatus === 'Inactive'
      ? '<span class="badge badge-danger">Off Grid</span>'
      : '<span class="badge badge-muted">Grid Unknown</span>'

  const peakBadge = appState.isPeakPeriod === true
    ? '<span class="badge badge-warning">Peak</span>'
    : appState.isPeakPeriod === false
      ? '<span class="badge badge-success">Off-Peak</span>'
      : '<span class="badge badge-muted">—</span>'

  const staleBanner = appState.stale
    ? `<div class="alert alert-warning">Data is stale — last updated ${appState.lastUpdated ? formatTime(appState.lastUpdated) : 'never'}. ${esc(appState.lastError)}</div>`
    : ''

  const errorBanner = appState.authState === 'error'
    ? `<div class="alert alert-danger">Gateway error — <a href="/ui">reconnect</a>. ${esc(appState.lastError)}</div>`
    : ''

  // ── Status card ──────────────────────────────────────────────────────────────

  const soc = appState.soc !== null ? Math.round(appState.soc) : null
  const socDisplay = soc !== null ? `${soc}%` : '—'
  const reserveRaw = appState.backupReservePercent
  const reserveDisplay = reserveRaw !== null
    ? `${Math.round(reserveRaw)}% (app: ${Math.max(0, Math.round(reserveRaw) - 5)}%)`
    : '—'

  const batteryBar = soc !== null
    ? `<div class="battery-wrap">
        <div class="battery-bar-bg">
          <div class="battery-bar-fill" style="width:${soc}%;background:${batteryBarColor(soc)}"></div>
        </div>
      </div>`
    : ''

  const statusCard = `
    <div class="card">
      <div class="card-title">Status ${gridBadge}</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-label">Battery</div>
          <div class="stat-value">${esc(socDisplay)}</div>
          ${batteryBar}
          <div class="stat-sub">Reserve ${esc(reserveDisplay)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Operation Mode</div>
          <div class="stat-value" style="font-size:1.1rem;line-height:1.3">${esc(formatOperationMode(appState.operationMode))}</div>
          <div class="stat-sub">${peakBadge}</div>
        </div>
      </div>
    </div>`

  // ── Power flows card ─────────────────────────────────────────────────────────

  const batteryDir = appState.batteryPower !== null
    ? appState.batteryPower > 50 ? 'discharging' : appState.batteryPower < -50 ? 'charging' : 'idle'
    : ''
  const gridDir = appState.gridPower !== null
    ? appState.gridPower > 50 ? 'importing' : appState.gridPower < -50 ? 'exporting' : 'balanced'
    : ''

  const powerCard = `
    <div class="card">
      <div class="card-title">Power Flows</div>
      <div class="stat-grid">
        <div class="stat">
          <div class="stat-label">Solar</div>
          <div class="stat-value">${esc(formatW(appState.solarPower))}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Home</div>
          <div class="stat-value">${esc(formatW(appState.homePower))}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Battery</div>
          <div class="stat-value">${esc(formatW(appState.batteryPower))}</div>
          ${batteryDir ? `<div class="stat-sub">${esc(batteryDir)}</div>` : ''}
        </div>
        <div class="stat">
          <div class="stat-label">Grid</div>
          <div class="stat-value">${esc(formatW(appState.gridPower))}</div>
          ${gridDir ? `<div class="stat-sub">${esc(gridDir)}</div>` : ''}
        </div>
      </div>
      <div class="row"><span class="row-label">Grid Voltage</span><span>${appState.gridVoltage !== null ? `${appState.gridVoltage.toFixed(1)} V` : '—'}</span></div>
      <div class="row"><span class="row-label">Grid Frequency</span><span>${appState.gridFrequency !== null ? `${appState.gridFrequency.toFixed(3)} Hz` : '—'}</span></div>
    </div>`

  // ── Lifetime energy card ──────────────────────────────────────────────────────

  const lifetimeCard = `
    <div class="card">
      <div class="card-title">Lifetime Energy</div>
      <div class="row"><span class="row-label">Solar Generated</span><span>${esc(formatWh(appState.solarExportedWh))}</span></div>
      <div class="row"><span class="row-label">Home Consumed</span><span>${esc(formatWh(appState.homeConsumedWh))}</span></div>
      <div class="row"><span class="row-label">Grid Imported</span><span>${esc(formatWh(appState.gridImportedWh))}</span></div>
      <div class="row"><span class="row-label">Grid Exported</span><span>${esc(formatWh(appState.gridExportedWh))}</span></div>
      <div class="row"><span class="row-label">Battery Charged</span><span>${esc(formatWh(appState.batteryChargedWh))}</span></div>
      <div class="row"><span class="row-label">Battery Discharged</span><span>${esc(formatWh(appState.batteryDischargedWh))}</span></div>
    </div>`

  // ── System card ───────────────────────────────────────────────────────────────

  const systemCard = appState.nominalCapacityWh !== null ? `
    <div class="card">
      <div class="card-title">System</div>
      <div class="row"><span class="row-label">Total Capacity</span><span>${esc(formatKwh(appState.nominalCapacityWh))} nominal${appState.numPowerwalls ? ` (${appState.numPowerwalls} units)` : ''}</span></div>
      <div class="row"><span class="row-label">Max Discharge</span><span>${esc(formatW(appState.maxDischargePowerW))}</span></div>
      <div class="row"><span class="row-label">Max Charge</span><span>${esc(formatW(appState.maxChargePowerW))}</span></div>
      ${appState.utility ? `<div class="row"><span class="row-label">Utility</span><span>${esc(appState.utility)}${appState.stateLocation ? `, ${esc(appState.stateLocation)}` : ''}</span></div>` : ''}
      ${appState.units && appState.units.length > 0 ? `
        <div class="unit-section">
          <div class="unit-section-label">Individual Units</div>
          ${unitRows(appState.units)}
          <p class="text-muted" style="font-size:.72rem;margin:.4rem 0 0">Degradation vs 13.5 kWh design capacity · refreshed hourly</p>
        </div>` : ''}
    </div>` : ''

  // ── Diagnostics card ──────────────────────────────────────────────────────────

  const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const formatDays = (days: number[] | undefined): string => {
    if (!days || days.length === 0 || days.length === 7) return 'all days'
    return days.map(d => DAYS_SHORT[d]).join('/')
  }
  const scheduleDisplay = settings.peakSchedule.length === 0
    ? 'not configured'
    : settings.peakSchedule.map(e =>
        `${hourLabel(e.startHour)}–${hourLabel(e.endHour)} (${MONTHS[e.monthStart]}–${MONTHS[e.monthEnd]}, ${formatDays(e.days)})`
      ).join(', ')

  const authBadge = appState.authState === 'polling'
    ? '<span class="badge badge-success">Connected</span>'
    : appState.authState === 'error'
      ? '<span class="badge badge-danger">Error</span>'
      : `<span class="badge badge-muted">${esc(appState.authState)}</span>`

  const diagnosticsCard = `
    <div class="card">
      <div class="card-title">Diagnostics</div>
      <div class="row"><span class="row-label">Site</span><span>${esc(appState.siteName ?? '—')}</span></div>
      <div class="row"><span class="row-label">Gateway</span><span><code>${esc(settings.gatewayIp ?? '—')}</code></span></div>
      <div class="row"><span class="row-label">Status</span><span>${authBadge}</span></div>
      <div class="row"><span class="row-label">Last Poll</span><span>${appState.lastUpdated ? formatTime(appState.lastUpdated) : 'never'}</span></div>
      <div class="row"><span class="row-label">SoC Thresholds</span><span>low ${settings.socLow != null ? Number(settings.socLow) : '—'} / high ${settings.socHigh != null ? Number(settings.socHigh) : '—'}</span></div>
      <div class="row"><span class="row-label">Peak Schedule</span><span>${esc(scheduleDisplay)}</span></div>
    </div>`

  // ── Events card ───────────────────────────────────────────────────────────────

  const eventRows = events.length === 0
    ? '<p class="empty-state">No transitions recorded yet.</p>'
    : events.map(e =>
        `<div class="event-row"><span>${esc(e.name)}</span><span class="event-time">${new Date(e.timestamp).toLocaleString()}</span></div>`
      ).join('')

  const eventsCard = `
    <div class="card">
      <div class="card-title">Recent Events</div>
      ${eventRows}
    </div>`

  return layout('Status', dashNav('status'), `
    ${staleBanner}${errorBanner}
    ${statusCard}
    ${powerCard}
    ${lifetimeCard}
    ${systemCard}
    ${diagnosticsCard}
    ${eventsCard}
    <form method="POST" action="/ui/gateway/disconnect" style="margin-top:.5rem">
      <button class="btn btn-danger-outline btn-sm" type="submit">Disconnect Gateway</button>
    </form>
    <meta http-equiv="refresh" content="30">
  `)
}

// Powerwall 2 design capacity per unit — used to compute degradation %
const DESIGN_CAPACITY_WH = 13_500

function unitRows(units: PowerwallUnit[]): string {
  return units.map((u, i) => {
    const socPct = u.nominalCapacityWh > 0
      ? Math.round((u.nominalEnergyWh / u.nominalCapacityWh) * 100)
      : 0
    const healthPct = Math.round((u.nominalCapacityWh / DESIGN_CAPACITY_WH) * 100)
    const degraded = Math.max(0, 100 - healthPct)
    const stateLabel = u.opState === 'Active' ? '<span class="badge badge-success">Active</span>' : `<span class="badge badge-muted">${esc(u.opState)}</span>`
    return `
      <div class="row">
        <span class="row-label">Unit ${i + 1} <span style="font-size:.7rem;color:var(--muted)">···${esc(u.serial)}</span></span>
        <span style="font-size:.8rem;display:flex;gap:.5rem;align-items:center">
          ${esc(formatKwh(u.nominalCapacityWh))}
          · ${degraded > 0 ? `${degraded}% degraded` : 'no degradation'}
          · ${socPct}% charged
          · ${esc(formatW(u.powerW))}
          · ${stateLabel}
        </span>
      </div>`
  }).join('')
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function peakRow(i: number, e: PeakScheduleEntry): string {
  const inp = (name: string, val: number, ph: string) =>
    `<input type="number" class="peak-input" name="w${i}_${name}" min="${name.includes('month') ? 1 : 0}" max="${name.includes('month') ? 12 : 23}" value="${val}" placeholder="${ph}">`
  const activeDays = (!e.days || e.days.length === 0) ? [0, 1, 2, 3, 4, 5, 6] : e.days
  const dayBoxes = DAY_LABELS.map((name, d) => {
    const checked = activeDays.includes(d) ? ' checked' : ''
    return `<label class="day-label"><input type="checkbox" name="w${i}_day_${d}" value="1"${checked} style="accent-color:var(--accent)"> ${name}</label>`
  }).join('')
  return `<div class="peak-row">
    <div class="peak-row-grid">
      ${inp('startHour',  e.startHour,  'e.g. 17')}
      ${inp('endHour',    e.endHour,    'e.g. 21')}
      ${inp('monthStart', e.monthStart, 'e.g. 5')}
      ${inp('monthEnd',   e.monthEnd,   'e.g. 10')}
      <button type="button" class="btn btn-secondary btn-sm" onclick="removePeakRow(this)" style="white-space:nowrap">Remove</button>
    </div>
    <div class="day-boxes">
      <span style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Days:</span>
      ${dayBoxes}
    </div>
  </div>`
}

// ── Settings page ──────────────────────────────────────────────────────────────

export function renderSettings({ settings, saved }: { settings: Settings; saved?: boolean }): string {
  return layout('Settings', dashNav('settings'), `
    ${saved ? '<div class="alert alert-success">Settings saved.</div>' : ''}
    <div class="card">
      <div class="card-title">SoC Thresholds</div>
      <form method="POST" action="/ui/settings">
        <div class="two-col" style="margin-bottom:1rem">
          <div class="form-group">
            <label class="form-label">Low threshold (%)</label>
            <input class="form-input" type="number" name="socLow" min="0" max="100" value="${settings.socLow != null ? Number(settings.socLow) : ''}" placeholder="e.g. 20">
            <p class="form-hint">Fires <code>soc_below_threshold</code></p>
          </div>
          <div class="form-group">
            <label class="form-label">High threshold (%)</label>
            <input class="form-input" type="number" name="socHigh" min="0" max="100" value="${settings.socHigh != null ? Number(settings.socHigh) : ''}" placeholder="e.g. 90">
            <p class="form-hint">Fires <code>soc_above_threshold</code></p>
          </div>
        </div>

        <hr>
        <div class="card-title" style="margin-bottom:.5rem">Peak Schedule</div>
        <p style="font-size:.8rem;color:var(--muted);margin:0 0 .75rem">
          Hours 0–23 (17 = 5 PM). Months 1–12. A range crossing year-end works normally — Nov to Apr means start 11, end 4.
          Months not covered by any window are considered off-peak.
        </p>
        <div class="peak-row-grid" style="margin-bottom:.3rem;padding:0 .1rem">
          <span style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Start hour</span>
          <span style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">End hour</span>
          <span style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Month start</span>
          <span style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Month end</span>
          <span></span>
        </div>
        <div id="peak-rows">
          ${settings.peakSchedule.map((e, i) => peakRow(i, e)).join('')}
        </div>
        <button type="button" class="btn btn-secondary btn-sm" onclick="addPeakRow()" style="margin-bottom:1rem">+ Add window</button>

        <script>
          var DEFAULT_DAYS = [false, true, true, true, true, true, false];
          var DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
          function peakRowHtml(i) {
            var dayBoxes = DAY_NAMES.map(function(name, d) {
              return '<label class="day-label"><input type="checkbox" name="w'+i+'_day_'+d+'" value="1"' + (DEFAULT_DAYS[d] ? ' checked' : '') + ' style="accent-color:var(--accent)"> ' + name + '</label>';
            }).join('');
            return '<div class="peak-row">' +
              '<div class="peak-row-grid">' +
              '<input type="number" class="peak-input" name="w'+i+'_startHour"  min="0"  max="23" placeholder="e.g. 17">' +
              '<input type="number" class="peak-input" name="w'+i+'_endHour"    min="0"  max="23" placeholder="e.g. 21">' +
              '<input type="number" class="peak-input" name="w'+i+'_monthStart" min="1"  max="12" placeholder="e.g. 5">' +
              '<input type="number" class="peak-input" name="w'+i+'_monthEnd"   min="1"  max="12" placeholder="e.g. 10">' +
              '<button type="button" class="btn btn-secondary btn-sm" onclick="removePeakRow(this)" style="white-space:nowrap">Remove</button>' +
              '</div>' +
              '<div class="day-boxes"><span style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Days:</span>' + dayBoxes + '</div>' +
              '</div>';
          }
          function addPeakRow() {
            var rows = document.getElementById('peak-rows');
            var idx = rows.querySelectorAll('.peak-row').length;
            var div = document.createElement('div');
            div.innerHTML = peakRowHtml(idx);
            rows.appendChild(div.firstChild);
          }
          function removePeakRow(btn) {
            btn.closest('.peak-row').remove();
            document.querySelectorAll('.peak-row').forEach(function(row, i) {
              row.querySelectorAll('input').forEach(function(inp) {
                inp.name = inp.name.replace(/w\\d+_/, 'w'+i+'_');
              });
            });
          }
        </script>
        <div>
          <button class="btn btn-primary" type="submit">Save Settings</button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card-title">Gateway</div>
      <div class="row"><span class="row-label">Connected to</span><span><code>${esc(settings.gatewayIp ?? '—')}</code></span></div>
      <div style="margin-top:1rem">
        <form method="POST" action="/ui/gateway/disconnect">
          <button class="btn btn-danger-outline btn-sm" type="submit">Disconnect and Reconfigure</button>
        </form>
      </div>
    </div>
  `)
}
