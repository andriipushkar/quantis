# Database Setup

## Technology

- **PostgreSQL 16** with **TimescaleDB** extension
- Docker image: `timescale/timescaledb:latest-pg16`

## Docker Setup (Development)

```bash
docker compose up -d postgres
```

Default config in `docker-compose.yml`:
- Port: 5433 (mapped from 5432 inside container)
- User: `quantis`
- Password: `quantis_dev_password`
- Database: `quantis`

## Migration

```bash
npm run db:migrate
```

Migration file: `database/migrations/001_initial_schema.sql`

## Schema Overview (19 Tables)

### Core Tables
| Table | Purpose |
|---|---|
| `users` | User accounts (email, password_hash, tier, language) |
| `user_profiles` | Extended profile (display_name, timezone, referral_code) |
| `subscriptions` | Active subscription tracking |
| `payments` | Payment history from NOWPayments |

### Market Data
| Table | Purpose |
|---|---|
| `exchanges` | Exchange config (binance, bybit, okx) |
| `trading_pairs` | Trading pair registry (20 pairs) |

### TimescaleDB Hypertables (OHLCV)
| Table | Interval | Retention |
|---|---|---|
| `ohlcv_1m` | 1 minute candles | 90 days |
| `ohlcv_5m` | 5 minute candles | 180 days |
| `ohlcv_15m` | 15 minute candles | 1 year |
| `ohlcv_1h` | 1 hour candles | 2 years |
| `ohlcv_4h` | 4 hour candles | 3 years |
| `ohlcv_1d` | Daily candles | Unlimited |
| `indicators` | Pre-calculated indicator values | Matches OHLCV |

### Analysis & Signals
| Table | Purpose |
|---|---|
| `signals` | Generated trading signals |

### User Features
| Table | Purpose |
|---|---|
| `alerts` | User alert configurations |
| `alert_history` | Triggered alert log |
| `watchlists` | User watchlist pairs |
| `referrals` | Referral tracking |

## Useful Queries

```sql
-- Check candle counts
SELECT 'ohlcv_1m' as tbl, COUNT(*) FROM ohlcv_1m
UNION ALL SELECT 'ohlcv_5m', COUNT(*) FROM ohlcv_5m
UNION ALL SELECT 'ohlcv_1h', COUNT(*) FROM ohlcv_1h;

-- Check exchanges and pairs
SELECT e.name, COUNT(tp.id) as pairs
FROM exchanges e
LEFT JOIN trading_pairs tp ON tp.exchange_id = e.id
GROUP BY e.name;

-- Check latest data
SELECT tp.symbol, MAX(o.time) as latest
FROM ohlcv_1m o JOIN trading_pairs tp ON tp.id = o.pair_id
GROUP BY tp.symbol ORDER BY latest DESC;

-- Check signals
SELECT type, strategy, COUNT(*) FROM signals GROUP BY type, strategy;
```

## Backup

```bash
# Manual backup
./scripts/backup.sh

# Restore from backup
gunzip -c backups/TIMESTAMP/quantis_db.sql.gz | docker exec -i quantis-postgres psql -U quantis quantis
```

## Connect Directly

```bash
docker exec -it quantis-postgres psql -U quantis -d quantis
```
