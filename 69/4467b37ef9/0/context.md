# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Plan: Move home_repeater from Stammdaten to BundMode (Issue #3)

## Context
Previous commit added `home_repeater` as an operator attribute in the Rufzeichen-Register (Stammdaten). User wants it instead as a per-exercise field in BundMode, next to the OP callsign input — same UX pattern. Store on `exercise_repeaters` table, not `operators`.

## Part 1: Revert previous commit's Stammdaten/Auswertung changes

Revert all 10 files touched by the previous commit. Spe...

### Prompt 2

document and then deploy

### Prompt 3

umsetzer nicht visible in the ausgerollten version

### Prompt 4

add repeater as dropdown

### Prompt 5

repeater can only be a repeater which is an oe link repeater

