#!/bin/sh
set -e

# Seed database on first run if it doesn't exist or is empty
if [ ! -f "$DATABASE_PATH" ] || [ ! -s "$DATABASE_PATH" ]; then
    echo "First run — seeding database..."
    node dist/server/db/seed.js
fi

# Start the server
exec node dist/server/index.js
