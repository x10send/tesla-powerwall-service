# Tesla Powerwall Service

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A self-hosted bridge service that connects directly to your Powerwall local gateway — no Tesla cloud account or API credentials required. Exposes a REST API, a web UI, and an MCP server for AI assistant integration.

## Architecture

```
[Powerwall Gateway]  HTTPS on your LAN (self-signed cert, cookie auth)
        │
[tesla-powerwall-service]  Docker container — TypeScript / Node.js
        │  polls gateway every 30s
        ├── REST API  →  Hubitat driver, scripts, automations
        ├── Web UI    →  live dashboard + settings
        └── MCP /mcp  →  AI assistants via mcp-edge-gateway
```

## Quick Start

```bash
docker run -d \
  --name powerwall-bridge \
  -p 3000:3000 \
  -v /path/to/data:/data \
  -e TZ=America/Chicago \
  ghcr.io/x10send/powerwall-bridge:latest
```

Open `http://<host-ip>:3000/ui` and enter your gateway IP and password (printed on the label on the back of the gateway).

## UnRaid Setup

1. Docker tab → **Add Container**
2. **Repository**: `ghcr.io/x10send/powerwall-bridge:latest`
3. **Port**: `3000:3000`
4. **Path**: Container `/data` → a persistent path (e.g. `/mnt/user/appdata/powerwall-bridge`)
5. **Variable**: `TZ` = your IANA timezone (e.g. `America/Chicago`)
6. Apply → open `http://<unraid-ip>:3000/ui` → enter gateway IP and password

## Local Development

```bash
npm install
npm run dev        # starts on http://localhost:3000 with auto-reload
npm test           # run all tests
npm run build      # compile TypeScript to dist/
```

Create a `.env` file with:

```
TZ=America/Chicago
DATA_DIR=.dev-data
```

## Web UI

Available at `/ui` (LAN-restricted):

- **Dashboard** — live power flows, battery SoC, grid status, per-unit Powerwall data and degradation %, lifetime energy totals
- **Settings** — on-peak schedule (multiple windows with month ranges and day-of-week), SoC thresholds
- **Setup** — enter and test gateway credentials

## REST API

All endpoints except `/health` are restricted to LAN IPs (RFC 1918 + loopback).

| Endpoint | Description |
|---|---|
| `GET /health` | Always 200 — Docker healthcheck |
| `GET /status` | Full current state (JSON) |
| `GET /events` | Recent transition events (newest first) |
| `GET /ui` | Web dashboard |
| `POST /grid/on` | Command: reconnect to grid |
| `POST /grid/off` | Command: island (go off-grid) |

### `/status` response

```json
{
  "authState": "polling",
  "soc": 90,
  "gridStatus": "Active",
  "solarPower": 2500,
  "batteryPower": -140,
  "gridPower": 30,
  "homePower": 2400,
  "isPeakPeriod": false,
  "operationMode": "autonomous",
  "backupReservePercent": 10,
  "gridVoltage": 120.8,
  "gridFrequency": 59.978,
  "stale": false,
  "lastUpdated": 1715716939000
}
```

### `/events` response

```json
{
  "events": [
    { "name": "grid_lost",     "timestamp": 1715716939000 },
    { "name": "grid_restored", "timestamp": 1715717199000 }
  ]
}
```

Event names: `grid_lost`, `grid_restored`, `peak_start`, `peak_end`, `soc_below_threshold`, `soc_above_threshold`.

## MCP Server

The service exposes an MCP streamable HTTP endpoint at `/mcp` (LAN-restricted) for use with AI assistants via [mcp-edge-gateway](https://github.com/x10send/mcp-edge-gateway).

### Tools

| Tool | Description |
|---|---|
| `get_powerwall_status` | Full current state snapshot |
| `get_recent_events` | Recent state-transition events (optional `limit`, max 50) |
| `set_grid_mode` | Set grid connection: `"on"` (connected) or `"off"` (islanded) |

### Gateway configuration

Add a route to your `gateway.yaml`:

```yaml
routes:
  - path: /powerwall
    upstream: http://<service-host>:3000
```

The gateway then exposes `/powerwall/mcp` through your Cloudflare tunnel.

## Peak Schedule

Configured in the web UI. Supports multiple windows with month ranges and day-of-week filters, e.g.:

| Window | Hours | Months |
|---|---|---|
| Summer afternoon | 2 PM – 8 PM | May – Oct |
| Winter morning | 5 AM – 9 AM | Nov – Apr |
| Winter evening | 5 PM – 9 PM | Nov – Apr |

Month ranges that cross the year boundary (e.g. Nov–Apr) are handled automatically.

## Releases

Tag to publish a new image to GHCR:

```bash
git tag v0.4.0
git push origin v0.4.0
```

The release workflow publishes:

```
ghcr.io/x10send/powerwall-bridge:0.4.0
ghcr.io/x10send/powerwall-bridge:0.4
ghcr.io/x10send/powerwall-bridge:0
ghcr.io/x10send/powerwall-bridge:latest
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). All contributions are welcome — please open an issue before starting large changes.

## License

[MIT](LICENSE)

## Hubitat Integration

For Hubitat Elevation automations driven by Powerwall state, see the [x10send/Hubitat](https://github.com/x10send/Hubitat) repository.
