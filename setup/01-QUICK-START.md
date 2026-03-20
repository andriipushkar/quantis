# Quantis — Quick Start Guide

## Prerequisites

- **Node.js** >= 20.0.0
- **Docker** + Docker Compose
- **Git**

## 1. Clone & Install

```bash
git clone https://github.com/andriipushkar/quantis.git
cd quantis
cp .env.example .env
npm install
```

## 2. Start Database & Cache

```bash
docker compose up -d postgres redis
```

Wait 10 seconds for services to be healthy:
```bash
docker compose ps
```

Expected: `quantis-postgres` and `quantis-redis` both `Up (healthy)`

## 3. Run Database Migration

```bash
npm run db:migrate
```

This creates 19 tables including TimescaleDB hypertables for OHLCV data.

## 4. Start All Services

```bash
# Start all 4 backend services + frontend
npm run dev
```

Or start individually:
```bash
# Terminal 1: API Gateway (port 3001)
npm run dev:api

# Terminal 2: Data Collector (port 3002)
npm run dev:collector

# Terminal 3: Analysis Engine (port 3003)
npm run dev:analysis

# Terminal 4: Alert Service (port 3004)
npm run dev:alerts

# Terminal 5: Frontend (port 5173)
npm run dev:client
```

## 5. Access the Platform

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001
- **API Docs (Swagger)**: http://localhost:3001/api/v1/docs/ui
- **Health Check**: http://localhost:3001/health

## 6. Create Test Account

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@quantis.io","password":"TestPass1234"}'
```

## 7. Verify Everything Works

```bash
# Check all services
for port in 3001 3002 3003 3004; do
  curl -s http://localhost:$port/health
  echo ""
done

# Check frontend
curl -s -o /dev/null -w "Frontend: HTTP %{http_code}\n" http://localhost:5173
```

## Troubleshooting

### Port conflicts
Default ports: PostgreSQL 5432, Redis 6379, API 3001, Frontend 5173.
Change in `.env` and `docker-compose.yml` if ports are occupied.

### Database auth failed
Make sure `.env` DB_PASSWORD matches docker-compose POSTGRES_PASSWORD.

### Empty charts
Data Collector needs ~1 minute to backfill historical data from Binance.
Check: `docker exec quantis-postgres psql -U quantis -d quantis -c "SELECT COUNT(*) FROM ohlcv_1m;"`
