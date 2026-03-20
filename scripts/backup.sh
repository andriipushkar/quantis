#!/bin/bash
set -e
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "Backing up Quantis database..."
docker exec quantis-postgres pg_dump -U quantis quantis | gzip > "$BACKUP_DIR/quantis_db.sql.gz"
echo "Backup saved to $BACKUP_DIR/quantis_db.sql.gz"

echo "Backing up .env..."
cp .env "$BACKUP_DIR/.env.backup" 2>/dev/null || true

echo "Backup complete: $BACKUP_DIR"
ls -la "$BACKUP_DIR"
