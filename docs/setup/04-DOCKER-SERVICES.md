# Docker Services Configuration

## Services Overview (8 total)

| Service | Image | Port | RAM | Purpose |
|---|---|---|---|---|
| `postgres` | timescale/timescaledb:pg16 | 5433 | 4GB | Database |
| `redis` | redis:7-alpine | 6381 | 1GB | Cache + Pub/Sub |
| `api-gateway` | node:20-alpine | 3001 | 1GB | REST API + WebSocket |
| `data-collector` | node:20-alpine | 3002 | 512MB | Exchange data collection |
| `analysis-engine` | node:20-alpine | 3003 | 2GB | Indicators + signals |
| `alert-service` | node:20-alpine | 3004 | 512MB | Alert evaluation |
| `client` | node:20-alpine / nginx | 5173/80 | 512MB | React frontend |
| `nginx` | nginx:alpine | 80/443 | 256MB | Reverse proxy + SSL |

## Development

```bash
# Start only DB + cache
docker compose up -d postgres redis

# Start all services (containers)
docker compose up -d

# View logs
docker compose logs -f api-gateway
docker compose logs -f data-collector

# Restart single service
docker compose restart api-gateway

# Stop all
docker compose down
```

## Production

```bash
# Build optimized images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# View status
docker compose ps
```

### Production Differences (`docker-compose.prod.yml`)
- `restart: always` on all services
- Multi-stage Dockerfiles (builder + production)
- No source code mounting (compiled code only)
- Redis password required
- Nginx with SSL/TLS
- Certbot for auto-renewal
- Persistent volumes on host filesystem

## Port Mapping

If default ports conflict with other services, change in `.env` and `docker-compose.yml`:

```yaml
# docker-compose.yml
postgres:
  ports:
    - "5433:5432"  # Change 5433 to any free port

redis:
  ports:
    - "6381:6379"  # Change 6381 to any free port
```

Then update `.env`:
```
DB_PORT=5433
REDIS_PORT=6381
```

## Health Checks

```bash
# All services health
for port in 3001 3002 3003 3004; do
  echo "Port $port: $(curl -s http://localhost:$port/health | python3 -c 'import sys,json; print(json.load(sys.stdin).get("status","?"))' 2>/dev/null)"
done
```

## Resource Requirements

### Minimum (Development)
- CPU: 2 cores
- RAM: 4GB
- Disk: 10GB

### Recommended (Production)
- CPU: 8 vCPU
- RAM: 16GB
- Disk: 200GB SSD
- Network: 100Mbps+
