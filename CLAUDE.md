# BOS-ARSA Log — BOS-ARSA Krisenkommunikationsübung

## What is this?
A real-time multi-user web app for weekly ham radio crisis communication exercises.
Admins log signal reports from amateur radio operators across Austria on multiple
repeaters and frequencies. Replaces a shared Excel workbook + two HTML prototypes.

## Tech Stack
- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Socket.IO client
- Backend: Node.js, Express, TypeScript, Socket.IO server
- Database: SQLite via better-sqlite3
- Auth: Simple callsign + PIN token auth
- Deployment: Docker, Cloudflare Tunnel

## Architecture
- Monorepo: /client (React SPA) + /server (Express API + WebSocket)
- RESTful API for CRUD, WebSocket for real-time sync
- SQLite DB file at /data/bosarsalog.db (Docker volume mounted)
- Server serves the built client in production

## Key Domain Concepts
- Operator (Rufzeichen): ham radio callsign, e.g. OE8YML, S55UJE
- Repeater/Frequency (Umsetzer): radio relay station with TX freq, offset, CTCSS
- Linked Repeater: one logical repeater spanning multiple physical sites (Einstiegspunkte)
- Einstiegspunkt: physical entry point in a linked repeater network
- Signal Report (Rapport): RST format e.g. "5/9+30 HK" = R5/S9+30dB via Hermannskogel
- Exercise (Übung): one Sunday session with configured repeaters and collected reports
- Bezirk: Austrian political district, identified by 2-3 letter code
- Bundesland: Austrian state (OE1=Wien through OE9=Vorarlberg)

## Conventions
- German UI text, English code
- Callsigns always uppercase
- RST format: R/S with optional +dB modifier and location suffix
- All timestamps in Europe/Vienna timezone
- API prefix: /api/v1/

## Common Commands
- `npm run dev` — start both client and server in dev mode
- `npm run build` — build for production
- `npm run db:seed` — seed database with reference data
- `docker compose up -d` — production deployment
