# BOS-ARSA Log — Sitzungsbericht 24.02.2026

## Erledigte Aufgaben

### #1 — Rapport soll verschiebbar innerhalb der Bezirke sein
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/1
- **Status:** Erledigt und deployed
- **Umsetzung:**
  - **Bezirk-Dropdown im Bearbeitungsmodus:** Beim Klicken auf einen Rapport erscheint ein Bezirk-Auswahlfeld neben Rapport, Notizen usw. Bezirk wechseln und mit OK bestätigen.
  - **Drag & Drop:** Rapport-Zeilen können per Drag & Drop zwischen Bezirk-Abschnitten verschoben werden. Das Ziel wird blau hervorgehoben. Funktioniert in Frequenzen- und OE-Link-Modus.
  - Dropdown funktioniert auf allen Geräten (inkl. Mobilgeräte), Drag & Drop auf Desktop.
  - Kein Backend-Änderung nötig — der PATCH-Endpunkt unterstützte `bezirk_code` bereits.

### Datenbank-Backup
- Produktions-Backup manuell über das bestehende Backup-Skript (`backup-bosarsalog.sh`) ausgelöst und auf Synology NAS verifiziert.
- Zusätzliches lokales Backup in `backups/bosarsalog-backup-2026-02-24.db` (1,6 MB, Integritätsprüfung bestanden).

### Repeater-Analyse
- Detaillierte Analyse der gemeldeten Verwirrung bei Schöckl 2m/70cm und Lachtal im Setup durchgeführt.
- **Ergebnis:** Kein Datenfehler — die Filterlogik (linked → OE-Link, non-linked → Frequenzen) funktioniert korrekt wie vorgesehen.

---

## Offene Issues

### #2 — Option Bezirkskenner in Simplex Frequenzen anzuzeigen
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/2
- Simplex-Frequenzen zeigen aktuell keine Bezirk-Zuordnung.

### #3 — Bei den Repeatern bitte „eigener Repeater" dazufügen — Klärung
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/3
- Klärungsbedarf: benutzerdefinierte Repeater können bereits über Einrichtung hinzugefügt werden. Zu klären, ob weitere Funktionalität gewünscht.

### #4 — Eingabe vom OP Rufzeichen wird nicht in Echtzeit übernommen
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/4
- OP-Rufzeichen-Änderungen werden erst nach Blur/Fokusverlust gespeichert, nicht in Echtzeit via WebSocket an andere Benutzer übertragen.

### #5 — Eventuell mehrere OPs bei Simplex
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/5
- Aktuell ein OP-Rufzeichen pro Repeater/Frequenz. Feature-Request für mehrere OPs bei Simplex.

### #6 — Rufzeichen doppelt eingeben führt zu Problemen
- **Issue:** https://github.com/achildrenmile/bosarsalog/issues/6
- Doppelte Rufzeichen-Eingabe verursacht Anzeige- und Löschprobleme. Reproduzierbar bei OE9-Rufzeichen.
