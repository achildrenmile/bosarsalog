# BOS-ARSA Log

**Amateurfunk Notfunkübung — Live-Erfassung, Multi-User, Auswertung**

A real-time, multi-user web application for BOS-ARSA amateur radio exercises across Austria. Multiple operators simultaneously log signal reports from ~100 ham radio stations on repeaters and direct frequencies. BOS-ARSA Log replaces the shared Excel workbook and standalone HTML prototypes with a single unified tool.

Part of the [oeradio.at](https://oeradio.at) ecosystem.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Socket.IO client |
| Backend | Node.js, Express, TypeScript, Socket.IO server |
| Database | SQLite via better-sqlite3 |
| Auth | Username/password with bcrypt + JWT tokens |
| Security | Helmet, rate limiting, CORS restriction, non-root Docker |
| Deployment | Docker, Docker Compose, Cloudflare Tunnel |

## Architecture

```
/client          React SPA (Vite)
/server          Express API + WebSocket server
/data            SQLite database (Docker volume-mounted)
```

- RESTful API for CRUD operations, WebSocket (Socket.IO) for real-time sync between concurrent users
- Server serves the built client in production
- SQLite keeps deployment simple — the data volume is small (~1,000 operators, ~200 reports/week)

## Key Domain Concepts

| Concept | Description |
|---------|-------------|
| **Operator (Rufzeichen)** | Ham radio callsign, e.g. OE8YML, S55UJE |
| **Repeater/Umsetzer** | Radio relay station with TX frequency, offset, CTCSS |
| **Linked Repeater** | One logical repeater spanning multiple physical sites (Einstiegspunkte) |
| **Einstiegspunkt** | Physical entry point in a linked repeater network, e.g. Hermannskogel (HK) |
| **Signal Report (Rapport)** | RST format, e.g. "5/9+30 HK" = R5 / S9+30dB via Hermannskogel |
| **Exercise (Übung)** | One session with configured repeaters and collected reports |
| **Bezirk** | Austrian political district, identified by 2-3 letter code |
| **Bundesland** | Austrian state (OE1=Wien through OE9=Vorarlberg) |
| **Nachbarland** | Neighbor country (SI, CZ, DE, IT, SK, HR, LI, CH, HU) |

## Features

### Two Data Entry Modes

- **Frequenzen (Land)** — Repeater-first entry. Select a repeater, enter reports grouped by Bezirk.
- **OE-Link (Bund)** — Geography-first entry. Bundesland/Bezirk hierarchy with linked repeater selection per district. Only available when OE-Link mode is enabled for the exercise.

### Exercise Setup

- Bundesland selection grid (OE1–OE9) with one-click activation of all repeaters per state
- ~80 pre-configured Austrian repeaters from OEVSV data
- Custom repeater and simplex frequency creation
- OE-Link toggle for linked repeater mode
- Per-repeater operator (OP) callsign assignment

### Interactive Austria Map with Neighbor Countries

- Choropleth map of Austria (OE1–OE9) with participant/report density
- 9 neighbor countries displayed: Germany, Czech Republic, Slovakia, Hungary, Slovenia, Italy, Switzerland, Liechtenstein, Croatia
- High-resolution borders from Natural Earth 10m data
- Countries with participating operators are color-coded by activity level
- Hover tooltips showing participant count and report count per region

### Automatic Callsign-to-Country Assignment

- Foreign callsign prefixes automatically mapped to the correct country (e.g. S55UJE → Slovenia, DL1ABC → Germany)
- Supported prefixes: OE1–OE9, S5 (Slovenia), OK/OL (Czech Republic), DA-DR (Germany), I (Italy), OM (Slovakia), 9A (Croatia), HB0 (Liechtenstein), HB (Switzerland), HA/HG (Hungary)
- Strips portable/mobile suffixes (/P, /M, /OE8) before matching
- Auto-derived on operator creation; existing operators backfilled via migration

### Live Multi-User

- Socket.IO real-time sync — reports entered by one user appear instantly for all others
- Running totals bar always visible: participant count, total reports, per-repeater counts
- Optimized for speed: autofocus, enter-to-submit, auto-uppercase, keyboard shortcuts

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+1` through `Alt+9` | Insert "5/1" through "5/9" in rapport field |
| `Ctrl+1` through `Ctrl+9` | Insert "OE1" through "OE9" in callsign field |
| `Enter` | Submit report and clear fields |
| `Arrow Up/Down` | Navigate autocomplete suggestions |
| `Escape` | Close autocomplete dropdown |

### Reports & Export

- **Per-exercise reports** — Summary with per-repeater and per-Bezirk/Bundesland/Land breakdown
- **Sonderauswertung (Aggregated Reports)** — Date-range aggregated statistics across multiple exercises
  - Quick-select buttons: Q1, Q2, Q3, Q4, full year
  - Custom date range (Von / Bis) picker
  - Summary cards: unique participants, total reports, exercise count, average participants per exercise
  - Collapsible exercise list with per-exercise breakdown
  - Deduplicates participants across exercises for accurate totals
- Interactive Austria map with neighbor countries showing participant distribution
- Bar chart (stations vs. reports) and pie chart (distribution by Bundesland/Land)
- Participants list with callsign, name, location, report count
- Export formats:
  - **PNG** — Full-page screenshot of the analytics view
  - **ADIF** — Amateur Data Interchange Format (.adi) for import into QRZ.com, LOTW, and other logbook software
  - **TXT OE-Link** — Bundesland-grouped text export
  - **TXT Frequenzen** — Repeater-grouped text export
  - **TXT Kombiniert** — Summary statistics with per-repeater breakdown

### Operator Registry

- Searchable operator database (callsign, name, QTH)
- Quick-add during live entry when callsign not found
- Inline editing of operator details (Name, QTH) directly from report entry forms
- Operator Name and QTH displayed alongside callsign in all report lists
- Paginated browsing (50 per page)
- Bulk import from official Fernmeldebehörde Rufzeichenliste PDF (see below)

### Security

- Helmet security headers (CSP, HSTS, X-Frame-Options)
- Rate limiting on login (10 attempts per 15 minutes)
- CORS restricted to configured origin
- JWT secret fail-fast in production
- Request body size limit (1MB)
- Input length validation
- Docker container runs as non-root user
- Port bound to localhost only (Cloudflare tunnel access)

### User Roles

| Capability | Admin | Erfasser |
|-----------|-------|----------|
| Create exercises | ✓ | — |
| Configure repeaters | ✓ | — |
| Change exercise name/date | ✓ | — |
| Enable OE-Link | ✓ | — |
| Enter/edit/delete reports | ✓ | ✓ |
| Manage operators | ✓ | ✓ |
| View analytics & export | ✓ | ✓ |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Development

```bash
# Install dependencies
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# Seed the database with reference data (idempotent — safe to run multiple times)
npm run db:seed

# Start both client and server in dev mode
npm run dev
```

The client runs on `http://localhost:5173` with API proxy to `http://localhost:3000`.

### Production (Docker)

```bash
# Build and run
docker compose up -d

# Seed database (first run only — idempotent, won't overwrite existing data)
docker exec bosarsalog node dist/server/db/seed.js
```

Required environment variables:

| Variable | Description |
|----------|-------------|
| `JWT_SECRET` | Random 64+ char secret (required in production) |
| `CORS_ORIGIN` | Allowed origin URL (default: `https://bosarsalog.oeradio.at`) |
| `DATABASE_PATH` | SQLite DB path (default: `/data/bosarsalog.db`) |

## API

All endpoints are prefixed with `/api/v1/`. Protected routes require `Authorization: Bearer <token>`.

### Auth

```
POST /api/v1/auth/login    { username, password } -> { token, admin }
```

### Exercises

```
GET    /api/v1/exercises              List all (with summary stats)
POST   /api/v1/exercises              Create { date, name }
GET    /api/v1/exercises/:id          Full exercise with reports
PATCH  /api/v1/exercises/:id          Update (name, organisator, oe_link)
GET    /api/v1/exercises/:id/stats    Live statistics
GET    /api/v1/exercises/:id/reports  All signal reports
POST   /api/v1/exercises/:id/reports  Create report
PATCH  /api/v1/exercises/:id/reports/:rid  Edit report
DELETE /api/v1/exercises/:id/reports/:rid  Delete report
```

### Exercise Repeaters

```
GET    /api/v1/exercises/:id/repeaters
POST   /api/v1/exercises/:id/repeaters      Activate repeater
PATCH  /api/v1/exercises/:id/repeaters/:rid  Update OP assignment
DELETE /api/v1/exercises/:id/repeaters/:rid  Deactivate repeater
```

### Operators

```
GET    /api/v1/operators         List/search (?q= for autocomplete)
POST   /api/v1/operators         Quick-add new operator
GET    /api/v1/operators/:id     Full profile with history
PATCH  /api/v1/operators/:id     Update operator
```

### Reference Data

```
GET /api/v1/reference/bundeslaender
GET /api/v1/reference/bezirke
GET /api/v1/reference/einstiegspunkte
GET /api/v1/repeaters
GET /api/v1/repeaters/:id/einstiegspunkte
```

### Aggregated Reports

```
GET /api/v1/reports/stats?from=YYYY-MM-DD&to=YYYY-MM-DD   Aggregated stats across date range
```

### Export

```
GET /api/v1/export/exercises/:id/bund      TXT (Bundesland-grouped)
GET /api/v1/export/exercises/:id/land      TXT (Repeater-grouped)
GET /api/v1/export/exercises/:id/combined  Summary report
```

### WebSocket Events (Socket.IO)

```
Client -> Server:
  join_exercise      { exercise_id }
  leave_exercise     { exercise_id }
  report_created     { report data }
  report_updated     { report data }
  report_deleted     { report_id }
  attendance_updated { attendance data }

Server -> Client (broadcast):
  report_created     { report, entered_by }
  report_updated     { report, entered_by }
  report_deleted     { report_id, entered_by }
  attendance_updated { attendance, entered_by }
```

## Rufzeichen Import (Fernmeldebehörde PDF)

Import operators from the official Austrian Rufzeichenliste PDF published by the Fernmeldebüro:

```bash
# Update mode (default) — insert new, update existing name/qth
RUFZEICHEN_MODE=update npm run import:rufzeichen -- /path/to/Rufzeichenliste.pdf

# Skip mode — insert new only, leave existing untouched
RUFZEICHEN_MODE=skip npm run import:rufzeichen -- /path/to/Rufzeichenliste.pdf
```

Requires `pdftotext` (poppler-utils). On NixOS: `nix-shell -p nodejs poppler-utils --run "..."`.

The script parses callsign, name, and Standort (QTH) from the PDF table. Bundesland is auto-derived from the callsign prefix. Redacted entries (`*-*-*`) are skipped. The import is idempotent.

## Seed Data

The seed script (`npm run db:seed`) is **idempotent** — it only inserts data if the tables are empty, and never deletes existing data. It populates:

- **18 Bundesländer** — 9 Austrian states + 9 international entries
- **84 Bezirke** — Austrian political districts with capital flags
- **~80 Repeaters** — Comprehensive OEVSV data across OE1–OE9 plus international and simplex
- **12 Einstiegspunkte** — Entry points for the Magdalensberg linked system
- **2 Users** — Admin and operator accounts

## Conventions

- German UI text, English code
- Callsigns always uppercase
- RST format: R/S with optional +dB modifier and location suffix
- All timestamps in Europe/Vienna timezone
- API prefix: `/api/v1/`
- Bezirk badges: Hauptstadt = red, normal = gray
- Bundesland headers with blue badges

## License

MIT
