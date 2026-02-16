# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Nachbarländer auf der Karte + automatische Rufzeichen-Zuordnung

## Context
Nachbarländer nehmen an BOS-ARSA-Übungen teil (z.B. S55UJE aus Slowenien). Die Karte zeigt derzeit nur Österreichs 9 Bundesländer. Ausländische Teilnehmer werden falsch zugeordnet (z.B. S55UJE → "05" OÖ statt "10" Slowenien), weil der Server `SUBSTR(o.callsign, 3, 1)` verwendet, was nur für OE-Rufzeichen funktioniert.

Ziel: Nachbarländer als Hintergrund auf der Karte zeigen, S...

### Prompt 2

deploy to production

