#!/bin/sh
set -e

echo "=========================================================="
echo "🚀 Starting UrGrowUp Smart Doorbell Application Container"
echo "=========================================================="

echo "⏳ Waiting for PostgreSQL database to be fully available..."
# Wait up to 30 seconds for Postgres
MAX_TRIES=30
COUNT=0
until npx prisma db push --skip-generate || [ $COUNT -eq $MAX_TRIES ]; do
  echo "Database is unavailable - sleeping 1 second ($COUNT/$MAX_TRIES)"
  COUNT=$((COUNT + 1))
  sleep 1
done

if [ $COUNT -eq $MAX_TRIES ]; then
  echo "⚠️ Database connection timed out. Attempting to start server anyway..."
else
  echo "✅ Database schema verified and synchronized!"
  echo "🌱 Seeding demo doorbells if not already present..."
  npm run db:seed || echo "Seed completed or already populated."
fi

echo "🚀 Launching Node.js Signaling & API Server on port $PORT..."
exec node dist/index.js
