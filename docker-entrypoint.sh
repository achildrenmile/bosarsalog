#!/bin/sh
set -e

# Start the server (schema migrations run automatically on startup)
# To seed an empty database, run: docker exec bosarsalog node dist/server/db/seed.js
exec node dist/server/index.js
