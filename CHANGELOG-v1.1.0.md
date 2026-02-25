# BOS-ARSA Log — CHANGELOG v1.1.0

**Release:** v1.1.0
**Zeitraum:** 24.–25. Februar 2026

---

## Neue Funktionen

### #1 — Rapport verschiebbar zwischen Bezirken
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/1
- **Bezirk-Dropdown im Bearbeitungsmodus:** Beim Klicken auf einen Rapport erscheint ein Bezirk-Auswahlfeld. Bezirk wechseln und mit OK bestätigen.
- **Drag & Drop:** Rapport-Zeilen können per Drag & Drop zwischen Bezirk-Abschnitten verschoben werden. Das Ziel wird blau hervorgehoben. Funktioniert in Frequenzen- und OE-Link-Modus.
- Dropdown funktioniert auf allen Geräten (inkl. Mobilgeräte), Drag & Drop auf Desktop.
- **OE-Link (BundMode):** Im Bearbeitungsmodus zeigt der Bezirk-Dropdown alle 9 Bundesländer mit ihren Bezirken (gruppiert als optgroup). Ermöglicht das Verschieben z.B. von Wien direkt nach Salzburg oder Kärnten.

### #2 — Simplex-Bezirke pro Übung
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/2
- **Neuer Toggle:** Admin-only Checkbox "Simplex Bezirke aktivieren" in der Übungs-Einrichtung. Standardmäßig deaktiviert.
- **Gruppierung:** Wenn aktiviert, zeigen Simplex-Frequenzkarten Bundesland-Unterüberschriften mit Bezirk-Zeilen statt flacher Liste.
- **BL-Auswahl konfigurierbar:** Unterhalb des Toggles erscheint ein Bundesländer-Grid. Admin kann pro Übung wählen, welche BLs angezeigt werden.
- Drag & Drop zwischen Bezirken funktioniert im gruppierten Modus.
- Nicht zugeordnete Rapporte erscheinen im "Sonstige"-Bereich.

### #3 — Eigener Repeater (REP) pro Übung im OE-Link-Modus
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/3
- **REP-Dropdown:** Neben dem OP-Rufzeichen im BL-Header (OE-Link-Modus) gibt es jetzt ein REP-Auswahlfeld.
- Zeigt nur OE-Link-Repeater. Labels: Standort + Band (z.B. "Magdalensberg 70cm").
- Aktuelle BL-Repeater zuerst, dann andere BLs mit Trennlinie.
- Speichert automatisch bei Auswahl. Echtzeit-Synchronisation zwischen Clients.
- **Per-Übung:** Der gewählte Repeater gilt nur für die aktuelle Übung, nicht global.

### #10 — Suffix-Buttons (/m /p /am /mm)
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/10
- **Toggle-Buttons** (m, p, am, mm) neben dem Rufzeichen-Feld in Frequenzen- und OE-Link-Modus.
- Radio-Verhalten: nur einer aktiv, nochmal klicken = deselect. Blau bei aktiv, grau bei inaktiv.
- Auswertung (Web + PDF): Teilnehmer-Tabelle zeigt Suffix neben Rufzeichen (z.B. "OE8YML/m").
- Bestehende Rapporte ohne Suffix funktionieren weiterhin.

### #8 — Server-seitiges PDF (Auswertung komplett)
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/8
- **Problem:** "Download Auswertung komplett" crashte den Browser bei umfangreichen Auswertungen (500MB+ RAM).
- **Lösung:** PDF-Generierung auf dem Server mit PDFKit. A4 Querformat, automatische Seitenumbrüche.
- Enthält: Header mit BOS-ARSA Branding, Summary-Cards, Repeater-Grid, Übungstabelle, Austria-Heatmap-Karte, Balken-/Tortendiagramm, Bezirk-/BL-Tabelle, Teilnehmer-Liste, Footer.
- Einzelne Chart-Downloads (Karte, Balken, Torte) bleiben als PNG — kein Funktionsverlust.

---

## Verbesserungen

### #4 — OP-Rufzeichen Echtzeit-Synchronisation
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/4
- OP-Rufzeichen werden jetzt in Echtzeit an alle Clients übertragen (Frequenzen- und OE-Link-Modus).

### #6 — Doppelte Rufzeichen-Eingabe behoben
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/6
- Bei doppelter Eingabe (gleicher Operator + gleicher Repeater) wird der bestehende Rapport nun korrekt aktualisiert statt ignoriert.

### #9 — Bundesland-Labels in Diagrammen
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/9
- Balken- und Tortendiagramm verwenden jetzt OE-Kurzform (z.B. "OE3" statt "Niederösterreich") — keine abgeschnittenen Labels mehr.

### #5 — Mehrere OPs bei Simplex
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/5
- Bereits möglich: Mehrere OPs können kommagetrennt im OP-Feld eingetragen werden (z.B. `OE1OP1, OE2OP2`).

---

## Interne Änderungen

### Datenbank-Backup
- Produktions-Backup manuell ausgelöst und auf Synology NAS verifiziert.
- Zusätzliches lokales Backup (1,6 MB, Integritätsprüfung bestanden).

### Schema-Migrationen (nicht-destruktiv)
- `exercises.simplex_bezirke` (INTEGER DEFAULT 0)
- `exercises.simplex_bl_codes` (TEXT)
- `signal_reports.suffix` (TEXT DEFAULT NULL)
- `exercise_repeaters.home_repeater` (TEXT DEFAULT NULL)
- `operators.home_repeater` (TEXT DEFAULT NULL — Legacy, nicht mehr verwendet)

### Geänderte Dateien (Gesamt)
`schema.ts`, `exercises.ts`, `operators.ts`, `reports.ts`, `pdf.ts` (Routes), `pdf.ts` (Service), `stats.ts`, `socket.ts`, `api.ts`, `ExerciseSetupPage.tsx`, `ExercisePage.tsx`, `LandMode.tsx`, `BundMode.tsx`, `OperatorsPage.tsx`, `ReportsPage.tsx`, `AggregatedReportsPage.tsx`, `HilfePage.tsx`

### Neue Dateien
- `server/src/services/pdf.ts` — PDF-Generator
- `server/src/routes/pdf.ts` — PDF-Endpunkte
