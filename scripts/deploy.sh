#!/bin/bash
set -e

echo "=== Quantis Production Deploy ==="
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Docker required"; exit 1; }
command -v docker compose >/dev/null 2>&1 || { echo "Docker Compose required"; exit 1; }

# Pull latest
echo "Pulling latest code..."
git pull origin main

# Build all services
echo "Building Docker images..."
docker compose build --no-cache

# Run migrations
echo "Running database migrations..."
docker compose up -d postgres redis
sleep 10
docker compose exec -T postgres psql -U quantis -d quantis -f /docker-entrypoint-initdb.d/001_initial_schema.sql 2>/dev/null || true

# Start all services
echo "Starting all services..."
docker compose up -d

# Health check
echo "Waiting for services..."
sleep 15

echo "=== Health Check ==="
for port in 3001 3002 3003 3004; do
  status=$(curl -s --max-time 5 http://localhost:$port/health | grep -o '"status":"[^"]*"' | head -1 || echo "failed")
  echo "  Port $port: $status"
done

echo ""
echo "=== Deploy Complete ==="
echo "Frontend: http://localhost"
echo "API: http://localhost/api/v1"
echo "Status: http://localhost/status"
