# Production Deployment Guide

## Server Requirements

- **OS:** Ubuntu 22.04+ LTS
- **CPU:** 8 vCPU minimum
- **RAM:** 16GB minimum
- **Disk:** 200GB SSD
- **Provider:** Hetzner CX41 (~$35/mo), DigitalOcean, AWS EC2

## Step 1: Server Setup

```bash
# SSH into server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Create app user
adduser quantis
usermod -aG docker quantis
su - quantis
```

## Step 2: Clone & Configure

```bash
git clone https://github.com/andriipushkar/quantis.git
cd quantis
cp .env.example .env
```

Edit `.env` with production values:
```bash
nano .env
```

**Critical changes for production:**
```env
NODE_ENV=production
APP_URL=https://quantis.io
CORS_ORIGINS=https://quantis.io,https://www.quantis.io
DB_PASSWORD=<strong-random-password>
REDIS_PASSWORD=<strong-random-password>
JWT_ACCESS_SECRET=<64-char-random-hex>
JWT_REFRESH_SECRET=<64-char-random-hex>
API_KEY_ENCRYPTION_KEY=<32-byte-random-hex>
ADMIN_EMAILS=your-email@domain.com
DOMAIN=quantis.io
```

Generate secrets:
```bash
node -e "console.log('JWT_ACCESS_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('API_KEY_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
```

## Step 3: DNS Configuration

Add DNS records at your domain registrar:
```
A    quantis.io        → your-server-ip
A    www.quantis.io    → your-server-ip
```

Wait for DNS propagation (5-60 minutes).

## Step 4: SSL Certificate

```bash
# Install certbot
apt install -y certbot

# Get certificate (before starting nginx)
certbot certonly --standalone -d quantis.io -d www.quantis.io
```

## Step 5: Build & Deploy

```bash
# Install dependencies
npm install

# Build production images
docker compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start everything
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Check status
docker compose ps
```

## Step 6: Verify

```bash
# Health check
curl https://quantis.io/health

# Test API
curl https://quantis.io/api/v1/market/ticker

# Test frontend
curl -s -o /dev/null -w "%{http_code}" https://quantis.io
```

## Step 7: Firewall

```bash
# UFW firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## Step 8: Auto-Updates & Monitoring

```bash
# Enable automatic security updates
apt install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

# Set up certbot auto-renewal (already in docker-compose.prod.yml)
# Or via cron:
crontab -e
# Add: 0 0 * * 0 certbot renew --quiet
```

## Updating

```bash
cd /home/quantis/quantis
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Or use the deploy script:
```bash
./scripts/deploy.sh
```

## Backup Cron

```bash
# Daily backup at 3 AM
crontab -e
# Add: 0 3 * * * /home/quantis/quantis/scripts/backup.sh
```

## Monitoring

- **Uptime:** Set up Uptime Kuma at a separate URL
- **Logs:** `docker compose logs -f --tail=100`
- **Metrics:** Grafana + Prometheus (optional)
- **Status page:** https://quantis.io/status
