# Session Context

## User Prompts

### Prompt 1

Implement the following plan:

# Issue #4: OP-Rufzeichen Echtzeit-Sync via WebSocket

## Context
Wenn ein User das OP-Rufzeichen bei einem Repeater ändert, sehen andere verbundene User die Änderung erst nach manuellem Reload. Das bestehende Pattern für Reports (emit → server broadcast → alle Clients updaten) soll auf OP-Callsigns angewendet werden.

## Änderungen

### 1. Server — `server/src/services/socket.ts`
Neues Event `op_callsign_updated` (gleicher Pattern wie `report_updated` Ze...

### Prompt 2

deploy mit ./deploy-production.sh

### Prompt 3

close issue https://github.com/achildrenmile/bosarsalog/issues/5 document that multiple operators are done by listing oe1op1, oe2op2

### Prompt 4

https://github.com/achildrenmile/bosarsalog/issues/6

### Prompt 5

[Request interrupted by user for tool use]

