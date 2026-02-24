# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Simplex Bezirke: BL-Auswahl konfigurierbar machen

## Context
Aktuell zeigt die Simplex-Bezirk-Gruppierung immer alle 9 BLs (OE1-OE9) hardcoded. Der User will pro Übung auswählen können, welche Bundesländer in der Simplex-Gruppierung angezeigt werden.

## Änderungen

### 1. Schema Migration — `server/src/db/schema.ts`
Nach der `simplex_bezirke`-Migration neue Spalte:
```sql
ALTER TABLE exercises ADD COLUMN simplex_bl_codes TEXT
```
Speichert komma-separier...

### Prompt 2

deploy mit ./deploy-production.sh

### Prompt 3

ist das ausgerollt. ich sehe es nicht

### Prompt 4

ja, commit und push

