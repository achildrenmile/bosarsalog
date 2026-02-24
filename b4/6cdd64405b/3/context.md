# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Issue #8: Download Auswertung — Server-seitiges PDF

## Context
"Download Auswertung komplett" nutzt `html-to-image` (`toPng()`), das den gesamten DOM klont — inkl. SVG-Karte, Chart.js-Diagramme, große Tabellen. Bei umfangreichen Auswertungen crasht der Browser (500MB+ RAM, Main Thread blockiert). Lösung: PDF-Generierung auf dem Server mit PDFKit (pure JS, kein Chromium nötig, läuft auf Alpine).

**Scope:** Nur die "Download Auswertung komplett"-Buttons a...

### Prompt 2

deploy mit ./deploy-production.sh

### Prompt 3

ja, commit, push und neu deployen

