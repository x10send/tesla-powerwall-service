import type { PowerwallState, TransitionEvent, PowerwallUnit } from '../state/store.js'
import type { Settings, PeakScheduleEntry } from '../settings.js'

function esc(s: string | null | undefined): string {
  return (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

const CSS = `
  body { font-family: system-ui, sans-serif; max-width: 860px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
  h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
  .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 2rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; }
  .card h2 { font-size: 1rem; margin: 0 0 1rem; color: #333; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
  .stat { background: #f5f5f5; border-radius: 6px; padding: 0.75rem; }
  .stat-label { font-size: 0.75rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-value { font-size: 1.4rem; font-weight: 600; margin-top: 0.2rem; }
  .stat-sub { font-size: 0.75rem; color: #888; margin-top: 0.15rem; }
  .badge { display: inline-block; padding: 0.2em 0.6em; border-radius: 999px; font-size: 0.75rem; font-weight: 600; }
  .badge-green { background: #d1fae5; color: #065f46; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-yellow { background: #fef3c7; color: #92400e; }
  .badge-gray { background: #f3f4f6; color: #374151; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .stale-warning { background: #fef3c7; border: 1px solid #fbbf24; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.9rem; }
  .error-box { background: #fee2e2; border: 1px solid #f87171; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.9rem; }
  .success-box { background: #d1fae5; border: 1px solid #6ee7b7; border-radius: 6px; padding: 0.75rem; margin-bottom: 1rem; font-size: 0.9rem; }
  input[type=text], input[type=number], input[type=password] { width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
  button, .btn { background: #1a1a1a; color: white; border: none; padding: 0.6rem 1.2rem; border-radius: 6px; font-size: 0.9rem; cursor: pointer; text-decoration: none; display: inline-block; }
  button.secondary { background: #e5e7eb; color: #1a1a1a; }
  button.danger { background: #dc2626; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
  .row:last-child { border-bottom: none; }
  .row-label { color: #6b7280; }
  .event-row { display: flex; justify-content: space-between; padding: 0.4rem 0; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
  .event-row:last-child { border-bottom: none; }
  .event-time { color: #9ca3af; }
  nav { margin-bottom: 1.5rem; }
  nav a { margin-right: 1rem; color: #6366f1; text-decoration: none; font-size: 0.9rem; }
  .form-group { margin-bottom: 0.875rem; }
  .form-label { display: block; margin-bottom: 0.25rem; font-size: 0.875rem; color: #374151; }
  .form-hint { font-size: 0.75rem; color: #9ca3af; margin-top: 0.2rem; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
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
  <p class="subtitle">Local Gateway → Hubitat</p>
  ${body}
</body>
</html>`
}

// ── Format helpers ────────────────────────────────────────────────────────────

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

// ── Setup page ────────────────────────────────────────────────────────────────

export function renderSetup({ error }: { error?: string } = {}): string {
  return layout('Setup', `
    ${error ? `<div class="error-box">${esc(error)}</div>` : ''}
    <div class="card">
      <h2>Connect Powerwall Gateway</h2>
      <p style="font-size:0.875rem;color:#666;margin-bottom:1.25rem">
        Enter the IP address and password for your Powerwall gateway.
        Find the password on the label on the back of the gateway unit,
        or in the Tesla app under Powerwall → Settings → Advanced.
      </p>
      <form method="POST" action="/ui/gateway/connect">
        <div class="form-group">
          <label class="form-label" for="ip">Gateway IP Address</label>
          <input type="text" id="ip" name="gatewayIp" placeholder="e.g. 192.168.1.x" required autocomplete="off">
        </div>
        <div class="form-group">
          <label class="form-label" for="pw">Gateway Password</label>
          <input type="password" id="pw" name="gatewayPassword" placeholder="Password from gateway label" required autocomplete="off">
          <p class="form-hint">This is stored in config.json on your Docker volume, not sent to Tesla.</p>
        </div>
        <button type="submit">Connect</button>
      </form>
    </div>
  `)
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

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
      : '<span class="badge badge-gray">Grid Unknown</span>'

  const staleBanner = appState.stale
    ? `<div class="stale-warning">⚠ Data is stale — last updated ${appState.lastUpdated ? formatTime(appState.lastUpdated) : 'never'}. ${esc(appState.lastError)}</div>`
    : ''

  const errorBanner = appState.authState === 'error'
    ? `<div class="error-box">Gateway error — <a href="/ui">reconnect</a>. ${esc(appState.lastError)}</div>`
    : ''

  const peakBadge = appState.isPeakPeriod === true
    ? '<span class="badge badge-yellow">Peak</span>'
    : appState.isPeakPeriod === false
      ? '<span class="badge badge-green">Off-Peak</span>'
      : '<span class="badge badge-gray">—</span>'

  // ── Status card ─────────────────────────────────────────────────────────────

  const socDisplay = appState.soc !== null ? `${Math.round(appState.soc)}%` : '—'
  // Gateway API adds Tesla's 5% minimum floor to whatever you configure in the app.
  // e.g. app setting of 5% → API reports 10%.
  const reserveRaw = appState.backupReservePercent
  const reserveDisplay = reserveRaw !== null
    ? `${Math.round(reserveRaw)}% (app: ${Math.max(0, Math.round(reserveRaw) - 5)}%)`
    : '—'

  const statusCard = `
    <div class="card">
      <h2>Status ${gridBadge}</h2>
      <div class="grid-2" style="margin-bottom:0.75rem">
        <div class="stat">
          <div class="stat-label">Battery</div>
          <div class="stat-value">${esc(socDisplay)}</div>
          <div class="stat-sub">Reserve: ${esc(reserveDisplay)}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Operation</div>
          <div class="stat-value" style="font-size:1.1rem">${esc(formatOperationMode(appState.operationMode))}</div>
          <div class="stat-sub">Peak: ${peakBadge}</div>
        </div>
      </div>
    </div>`

  // ── Power flows card ─────────────────────────────────────────────────────────

  const powerCard = `
    <div class="card">
      <h2>Power Flows</h2>
      <div class="grid-2" style="margin-bottom:0.75rem">
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
          <div class="stat-sub">${appState.batteryPower !== null ? (appState.batteryPower > 0 ? 'discharging' : appState.batteryPower < 0 ? 'charging' : 'idle') : ''}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Grid</div>
          <div class="stat-value">${esc(formatW(appState.gridPower))}</div>
          <div class="stat-sub">${appState.gridPower !== null ? (appState.gridPower > 0 ? 'importing' : appState.gridPower < 0 ? 'exporting' : 'balanced') : ''}</div>
        </div>
      </div>
      <div class="row">
        <span class="row-label">Grid Voltage</span>
        <span>${appState.gridVoltage !== null ? `${appState.gridVoltage.toFixed(1)} V` : '—'}</span>
      </div>
      <div class="row">
        <span class="row-label">Grid Frequency</span>
        <span>${appState.gridFrequency !== null ? `${appState.gridFrequency.toFixed(3)} Hz` : '—'}</span>
      </div>
    </div>`

  // ── Lifetime energy card ──────────────────────────────────────────────────────

  const lifetimeCard = `
    <div class="card">
      <h2>Lifetime Energy</h2>
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
      <h2>System</h2>
      <div class="row"><span class="row-label">Total Capacity</span><span>${esc(formatKwh(appState.nominalCapacityWh))} nominal${appState.numPowerwalls ? ` (${appState.numPowerwalls} units)` : ''}</span></div>
      <div class="row"><span class="row-label">Max Discharge</span><span>${esc(formatW(appState.maxDischargePowerW))}</span></div>
      <div class="row"><span class="row-label">Max Charge</span><span>${esc(formatW(appState.maxChargePowerW))}</span></div>
      ${appState.utility ? `<div class="row"><span class="row-label">Utility</span><span>${esc(appState.utility)}${appState.stateLocation ? `, ${esc(appState.stateLocation)}` : ''}</span></div>` : ''}
      ${appState.units && appState.units.length > 0 ? `
        <div style="margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid #f3f4f6">
          <div style="font-size:0.75rem;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.25rem">Individual Units</div>
          ${unitRows(appState.units)}
          <div style="font-size:0.7rem;color:#9ca3af;margin-top:0.35rem">Degradation vs 13.5 kWh design capacity · refreshed hourly</div>
        </div>` : ''}
    </div>` : ''

  // ── Diagnostics card ──────────────────────────────────────────────────────────

  const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const scheduleDisplay = settings.peakSchedule.length === 0
    ? 'not configured'
    : settings.peakSchedule.map(e =>
        `${hourLabel(e.startHour)}–${hourLabel(e.endHour)} (${MONTHS[e.monthStart]}–${MONTHS[e.monthEnd]})`
      ).join(', ')

  const diagnosticsCard = `
    <div class="card">
      <h2>Diagnostics</h2>
      <div class="row"><span class="row-label">Site</span><span>${esc(appState.siteName ?? '—')}</span></div>
      <div class="row"><span class="row-label">Gateway</span><span>${esc(settings.gatewayIp ?? '—')}</span></div>
      <div class="row"><span class="row-label">Status</span><span>${esc(appState.authState)}</span></div>
      <div class="row"><span class="row-label">Last Poll</span><span>${appState.lastUpdated ? formatTime(appState.lastUpdated) : 'never'}</span></div>
      <div class="row"><span class="row-label">SoC Thresholds</span><span>low ${settings.socLow ?? '—'} / high ${settings.socHigh ?? '—'}</span></div>
      <div class="row"><span class="row-label">Peak Schedule</span><span>${esc(scheduleDisplay)}</span></div>
    </div>`

  // ── Events card ───────────────────────────────────────────────────────────────

  const eventRows = events.length === 0
    ? '<p style="color:#9ca3af;font-size:0.875rem">No transitions recorded yet.</p>'
    : events.map(e =>
        `<div class="event-row"><span>${esc(e.name)}</span><span class="event-time">${new Date(e.timestamp).toLocaleString()}</span></div>`
      ).join('')

  const eventsCard = `
    <div class="card">
      <h2>Recent Events</h2>
      ${eventRows}
    </div>`

  return layout('Dashboard', `
    <nav><a href="/ui">Status</a><a href="/ui/settings">Settings</a></nav>
    ${staleBanner}${errorBanner}
    ${statusCard}
    ${powerCard}
    ${lifetimeCard}
    ${systemCard}
    ${diagnosticsCard}
    ${eventsCard}
    <form method="POST" action="/ui/gateway/disconnect" style="margin-top:1rem">
      <button class="danger secondary" type="submit">Disconnect Gateway</button>
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
    const stateLabel = u.opState === 'Active' ? '✓ Active' : esc(u.opState)
    return `
      <div class="row">
        <span class="row-label">Unit ${i + 1} <span style="font-size:0.7rem;color:#9ca3af">···${esc(u.serial)}</span></span>
        <span style="font-size:0.85rem">
          ${esc(formatKwh(u.nominalCapacityWh))} cap
          &nbsp;·&nbsp; ${degraded > 0 ? `${degraded}% degraded` : 'no degradation'}
          &nbsp;·&nbsp; ${socPct}% charged
          &nbsp;·&nbsp; ${esc(formatW(u.powerW))}
          &nbsp;·&nbsp; ${stateLabel}
        </span>
      </div>`
  }).join('')
}

function peakRow(i: number, e: PeakScheduleEntry): string {
  const inp = (name: string, val: number, ph: string) =>
    `<input type="number" name="w${i}_${name}" min="${name.includes('month') ? 1 : 0}" max="${name.includes('month') ? 12 : 23}" value="${val}" placeholder="${ph}" style="padding:.4rem;border:1px solid #ddd;border-radius:4px;font-size:.95rem">`
  return `<div class="peak-row" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.5rem;align-items:center">
    ${inp('startHour',  e.startHour,  'e.g. 17')}
    ${inp('endHour',    e.endHour,    'e.g. 21')}
    ${inp('monthStart', e.monthStart, 'e.g. 5')}
    ${inp('monthEnd',   e.monthEnd,   'e.g. 10')}
    <button type="button" class="secondary" onclick="removePeakRow(this)" style="white-space:nowrap">Remove</button>
  </div>`
}

// ── Settings page ─────────────────────────────────────────────────────────────

export function renderSettings({ settings, saved }: { settings: Settings; saved?: boolean }): string {
  return layout('Settings', `
    <nav><a href="/ui">Status</a><a href="/ui/settings">Settings</a></nav>
    ${saved ? '<div class="success-box">Settings saved.</div>' : ''}
    <div class="card">
      <h2>SoC Thresholds</h2>
      <form method="POST" action="/ui/settings">
        <div class="two-col" style="margin-bottom:0.875rem">
          <div class="form-group">
            <label class="form-label">Low threshold (%)</label>
            <input type="number" name="socLow" min="0" max="100" value="${settings.socLow ?? ''}" placeholder="e.g. 20">
            <p class="form-hint">Fires <code>soc_below_threshold</code></p>
          </div>
          <div class="form-group">
            <label class="form-label">High threshold (%)</label>
            <input type="number" name="socHigh" min="0" max="100" value="${settings.socHigh ?? ''}" placeholder="e.g. 90">
            <p class="form-hint">Fires <code>soc_above_threshold</code></p>
          </div>
        </div>
        <h2 style="font-size:1rem;margin:1rem 0 0.5rem;color:#333">Peak Schedule</h2>
        <p style="font-size:0.8rem;color:#6b7280;margin:0 0 0.75rem">
          Hours: 0–23 (17 = 5 PM). Months: 1–12 (11 = Nov).
          A month range that crosses year-end works normally — Nov to Apr means start 11, end 4.
          Any months not covered by a window are considered off-peak.
        </p>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.35rem">
          <span style="font-size:0.72rem;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Start hour</span>
          <span style="font-size:0.72rem;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">End hour</span>
          <span style="font-size:0.72rem;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Month start</span>
          <span style="font-size:0.72rem;color:#6b7280;text-transform:uppercase;letter-spacing:.04em">Month end</span>
          <span></span>
        </div>
        <div id="peak-rows">
          ${settings.peakSchedule.map((e, i) => peakRow(i, e)).join('')}
        </div>
        <button type="button" class="secondary" onclick="addPeakRow()" style="margin-top:0.4rem;font-size:0.85rem">+ Add window</button>
        <script>
          function peakRowHtml(i) {
            return '<div class="peak-row" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr auto;gap:0.5rem;margin-bottom:0.5rem;align-items:center">' +
              '<input type="number" name="w'+i+'_startHour" min="0" max="23" placeholder="e.g. 17" style="padding:.4rem;border:1px solid #ddd;border-radius:4px;font-size:.95rem">' +
              '<input type="number" name="w'+i+'_endHour"   min="0" max="23" placeholder="e.g. 21" style="padding:.4rem;border:1px solid #ddd;border-radius:4px;font-size:.95rem">' +
              '<input type="number" name="w'+i+'_monthStart" min="1" max="12" placeholder="e.g. 5"  style="padding:.4rem;border:1px solid #ddd;border-radius:4px;font-size:.95rem">' +
              '<input type="number" name="w'+i+'_monthEnd"   min="1" max="12" placeholder="e.g. 10" style="padding:.4rem;border:1px solid #ddd;border-radius:4px;font-size:.95rem">' +
              '<button type="button" class="secondary" onclick="removePeakRow(this)" style="white-space:nowrap">Remove</button>' +
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
                inp.name = inp.name.replace(/w\d+_/, 'w'+i+'_');
              });
            });
          }
        </script>
        <button type="submit">Save</button>
      </form>
    </div>
    <div class="card">
      <h2>Gateway</h2>
      <div class="row"><span class="row-label">Connected to</span><span>${esc(settings.gatewayIp ?? '—')}</span></div>
      <div style="margin-top:1rem">
        <form method="POST" action="/ui/gateway/disconnect">
          <button class="secondary" type="submit">Disconnect and Reconfigure</button>
        </form>
      </div>
    </div>
  `)
}
