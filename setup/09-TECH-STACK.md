# Technology Stack

## Frontend

| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5.8 | Type safety |
| Vite | 5 | Build tool + HMR |
| Tailwind CSS | 3.4 | Utility-first CSS |
| Zustand | 4 | State management |
| TanStack Query | 5 | Server state + caching |
| React Router | 6 | Client-side routing |
| Socket.IO Client | 4 | WebSocket connection |
| TradingView Lightweight Charts | 4 | Candlestick charts |
| react-i18next | 13 | Internationalization |
| react-hook-form | 7 | Form management |
| Zod | 3 | Schema validation |
| class-variance-authority | 0.7 | Component variants |
| lucide-react | 0.400+ | Icons |
| date-fns | 3 | Date formatting |
| Vitest | 4 | Client unit testing |

## Backend

| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20+ | Runtime |
| TypeScript | 5.8 | Type safety |
| Express | 4.18 | HTTP framework |
| Socket.IO | 4 | WebSocket server |
| PostgreSQL | 16 | Primary database |
| TimescaleDB | latest | Time-series extension |
| Redis | 7 | Cache + Pub/Sub + Rate limiting |
| Bull | 4 | Job queues |
| ioredis | 5 | Redis client |
| pg | 8 | PostgreSQL client |
| bcryptjs | 2.4 | Password hashing |
| jsonwebtoken | 9 | JWT tokens |
| helmet | 7 | Security headers |
| cors | 2 | CORS middleware |
| compression | 1.7 | gzip compression |
| winston | 3 | Structured logging |
| ccxt | 4 | Exchange library (data-collector) |
| ws | 8 | WebSocket client (exchanges) |
| nodemailer | 6 | Email delivery |
| technicalindicators | 3 | Indicator calculations |
| Jest | 29 | Unit testing |
| tsx | 4 | TypeScript execution |

## Infrastructure

| Technology | Purpose |
|---|---|
| Docker + Docker Compose | Containerization |
| Nginx | Reverse proxy + SSL + Rate limiting |
| Let's Encrypt / Certbot | Free SSL certificates |
| GitHub Actions | CI/CD pipeline |
| Playwright | E2E testing |

## Design System

| Element | Value |
|---|---|
| Primary (Gold) | `#C9A84C` → `hsl(42 52% 54%)` |
| Background (Dark) | `#0B0E11` → `hsl(220 20% 4%)` |
| Background (Light) | `#F8F6F0` → `hsl(40 20% 97%)` |
| Success (Green) | `#0ECB81` → `hsl(155 82% 43%)` |
| Danger (Red) | `#F6465D` → `hsl(354 79% 63%)` |
| Font | Inter, -apple-system |
| Monospace | JetBrains Mono (numbers) |
| Border radius | 0.75rem |

## Architecture Pattern

```
Browser ←→ Vite Dev Server / Nginx
              ↓
         API Gateway (Express + Socket.IO)
         ↙    ↓     ↘
  PostgreSQL  Redis   External APIs
  TimescaleDB  ↑      (Binance, Bybit, OKX)
              ↑
     Data Collector (WebSocket)
     Analysis Engine (indicators, signals)
     Alert Service (evaluation, delivery)
```
