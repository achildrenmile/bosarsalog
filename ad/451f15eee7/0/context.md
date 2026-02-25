# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Plan: Allow duplicate callsigns in reports

## Context
Currently `signal_reports` has a `UNIQUE (exercise_id, operator_id, repeater_id)` constraint — same callsign can only appear once per repeater per exercise. User wants to allow the same callsign multiple times (e.g. operator checks in again later with different signal conditions).

## Changes

### 1. Schema: `server/src/db/schema.ts`
- Add migration: detect the UNIQUE constraint and recreate `signal_reports...

### Prompt 2

deploy and create a new sub release 1.10.1.

### Prompt 3

update memory with the duplicate callsigns feature

### Prompt 4

bug qth will not be stored on adding callsigns! at least in bund view

### Prompt 5

deploy

### Prompt 6

qth filled out from lookup, but not shown. see entries in https://bosarsalog.oeradio.at/exercises/0b6cda0a-0a2b-4f15-b121-fed5d2bc83d3

