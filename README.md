# BOS-ARSA Log

**Krisenkommunikationsübung — Live-Erfassung, Multi-User, Auswertung**

A real-time, multi-user web application for the BOS-ARSA weekly ham radio crisis communication exercises. Every Sunday, a team of admin operators queries multiple repeaters and direct frequencies across Austria to collect signal reports from ~100 amateur radio operators. BOS-ARSA Log replaces the shared Excel workbook and standalone HTML prototypes with a single unified tool.

Part of the [oeradio.at](https://oeradio.at) ecosystem.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Socket.IO client |
| Backend | Node.js, Express, TypeScript, Socket.IO server |
| Database | SQLite via better-sqlite3 |
| Auth | Simple callsign + PIN with JWT tokens |
| Deployment | Docker, Docker Compose, Cloudflare Tunnel |

## Architecture

```
/client          React SPA (Vite)
/server          Express API + WebSocket server
/data            SQLite database (volume-mounted in Docker)
```

- RESTful API for CRUD operations, WebSocket (Socket.IO) for real-time sync between concurrent admins
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
| **Exercise (Übung)** | One Sunday session with configured repeaters and collected reports |
| **Bezirk** | Austrian political district, identified by 2-3 letter code |
| **Bundesland** | Austrian state (OE1=Wien through OE9=Vorarlberg) |

## Features

### Two Data Entry Modes

- **Land (Umsetzer)** — Repeater-first entry. Select a repeater, enter reports grouped by Bezirk. Cross-repeater callsign sync: adding a callsign on one repeater auto-creates placeholder entries on all others.
- **Bund (Bundesland)** — Geography-first entry. Bundesland/Bezirk hierarchy with inline entry per district. Einstiegspunkt auto-propagation: selecting an entry point in one Wien district auto-applies it to all Wien districts.

### Live Multi-User

- Socket.IO real-time sync — reports entered by one admin appear instantly for all others
- Running totals bar always visible: participant count, total reports, per-repeater counts
- Optimized for speed: autofocus, enter-to-submit, auto-uppercase, keyboard shortcuts

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt+1` through `Alt+9` | Insert "5/1" through "5/9" in rapport field |
| `Ctrl+1` through `Ctrl+9` | Insert "OE1" through "OE9" in callsign field |
| `Enter` | Submit report and clear fields |
| `Arrow Up/Down` | Navigate autocomplete suggestions |

### Reports & Export

- Exercise summary with per-repeater breakdown
- Nebenstationen report (participants by district)
- TXT export in Bund format (Bundesland-grouped) and Land format (repeater-grouped)

### Operator Registry

- Searchable/filterable list of all operators
- Quick-add during live entry when callsign not found
- Full profile with equipment, location, membership flags

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

# Seed the database with reference data
npm run db:seed

# Start both client and server in dev mode
npm run dev
```

The client runs on `http://localhost:5173` with API proxy to `http://localhost:3000`.

### Default Login

| Callsign | PIN | Role |
|----------|-----|------|
| OE8YML | changeme | admin |

### Production (Docker)

```bash
# Build and run
docker compose up -d

# Seed database (first run)
docker exec bosarsalog node dist/server/db/seed.js
```

### Deploy to Remote Host

```bash
# Configure deployment
cp .env.production.example .env.production
# Edit .env.production with your settings

# Deploy
./deploy-production.sh

# Rebuild without cache
./deploy-production.sh --rebuild
```

## API

All endpoints are prefixed with `/api/v1/`. Protected routes require `Authorization: Bearer <token>`.

### Auth

```
POST /api/v1/auth/login    { callsign, pin } -> { token, admin }
```

### Exercises

```
GET    /api/v1/exercises              List all (with summary stats)
POST   /api/v1/exercises              Create { date }
GET    /api/v1/exercises/:id          Full exercise with reports
PATCH  /api/v1/exercises/:id          Update status/notes
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

## Database Schema

### Tables

| Table | Description | Records |
|-------|-------------|---------|
| `bundeslaender` | Austrian states + international | 18 |
| `bezirke` | Political districts | 84 |
| `operators` | Ham radio operator registry | ~1,066 |
| `repeaters` | Repeater/frequency master list | 11 |
| `einstiegspunkte` | Entry points for linked repeaters | 12 |
| `exercises` | Weekly exercise sessions | growing |
| `exercise_repeaters` | Active repeaters per exercise | per exercise |
| `exercise_attendance` | Participant tracking | per exercise |
| `signal_reports` | The core data — signal reports | ~200/week |
| `admins` | Admin users | ~5 |

## Seed Data

The seed script (`npm run db:seed`) populates:

- **9 Austrian Bundesländer** + 9 international entries (Slowenien, CZ, Deutschland, Italien, Slowakei, Kroatien, Liechtenstein, CH, Ungarn)
- **84 Austrian Bezirke** with capital flags
- **11 Repeaters**: Gerlitze 2m/70cm, Magdalensberg linked, Buschberg, Goldeck, Dobratsch 23cm, Struška, Hochstuhl, Zirbitzkogel, Direkte 145.300/145.525
- **12 Einstiegspunkte** for the Magdalensberg linked system (HK, GB, NBST, JAU, FK, SCHÖ, LT, Telfs, Hochstein, Ahorn, MK, DO)
- **Default admin** OE8YML with PIN "changeme"

## Conventions

- German UI text, English code
- Callsigns always uppercase
- RST format: R/S with optional +dB modifier and location suffix
- All timestamps in Europe/Vienna timezone
- API prefix: `/api/v1/`
- Bezirk badges: Hauptstadt = red (#dc3545), normal = gray (#6c757d)
- Bundesland headers with blue badges (#0d6efd)
- Warm beige background (#faf3e4)

## License

MIT
