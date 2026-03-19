-- 001_initial_schema.sql
-- Initial database schema for Quantis crypto platform

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE user_tier AS ENUM ('starter', 'trader', 'pro', 'institutional');
CREATE TYPE language AS ENUM ('en', 'ua', 'ru');
CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE ui_mode AS ENUM ('beginner', 'trader', 'pro');
CREATE TYPE subscription_status AS ENUM ('active', 'expired', 'cancelled', 'grace_period');
CREATE TYPE payment_status AS ENUM ('pending', 'confirmed', 'failed', 'refunded');
CREATE TYPE signal_type AS ENUM ('buy', 'sell', 'close');
CREATE TYPE signal_strength AS ENUM ('weak', 'medium', 'strong');
CREATE TYPE signal_status AS ENUM ('active', 'triggered', 'expired', 'cancelled');

-- ============================================================
-- Trigger function: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Tables
-- ============================================================

-- Users
CREATE TABLE users (
    id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    email         VARCHAR(255)  UNIQUE NOT NULL,
    password_hash TEXT          NOT NULL,
    tier          user_tier     DEFAULT 'starter',
    language      language      DEFAULT 'en',
    is_2fa_enabled BOOLEAN      DEFAULT false,
    totp_secret_enc TEXT,
    created_at    TIMESTAMPTZ   DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_updated_at();

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_tier ON users (tier);

-- User Profiles
CREATE TABLE user_profiles (
    user_id          UUID             PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
    display_name     VARCHAR(50),
    timezone         VARCHAR(50)      DEFAULT 'UTC',
    balance_usdt     NUMERIC(18,8)    DEFAULT 0,
    referral_code    VARCHAR(20)      UNIQUE,
    experience_level experience_level DEFAULT 'beginner',
    ui_mode          ui_mode          DEFAULT 'beginner',
    created_at       TIMESTAMPTZ      DEFAULT NOW()
);

-- Subscriptions
CREATE TABLE subscriptions (
    id          UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID                NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    tier        user_tier           NOT NULL,
    starts_at   TIMESTAMPTZ         NOT NULL,
    expires_at  TIMESTAMPTZ         NOT NULL,
    status      subscription_status DEFAULT 'active',
    payment_id  UUID,
    auto_renew  BOOLEAN             DEFAULT true,
    created_at  TIMESTAMPTZ         DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions (user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions (status);
CREATE INDEX idx_subscriptions_expires_at ON subscriptions (expires_at);

-- Payments
CREATE TABLE payments (
    id                 UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id            UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    subscription_id    UUID           REFERENCES subscriptions (id) ON DELETE SET NULL,
    amount_usd         NUMERIC(18,2)  NOT NULL,
    crypto_currency    VARCHAR(20),
    crypto_amount      NUMERIC(24,8),
    tx_hash            VARCHAR(128),
    gateway_payment_id VARCHAR(128),
    status             payment_status DEFAULT 'pending',
    created_at         TIMESTAMPTZ    DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id ON payments (user_id);
CREATE INDEX idx_payments_status ON payments (status);
CREATE INDEX idx_payments_tx_hash ON payments (tx_hash);

-- Add FK from subscriptions.payment_id -> payments.id (deferred to avoid circular dep)
ALTER TABLE subscriptions
    ADD CONSTRAINT fk_subscriptions_payment_id
    FOREIGN KEY (payment_id) REFERENCES payments (id) ON DELETE SET NULL;

-- Exchanges
CREATE TABLE exchanges (
    id               SERIAL       PRIMARY KEY,
    name             VARCHAR(50)  UNIQUE NOT NULL,
    api_base_url     TEXT,
    ws_url           TEXT,
    status           VARCHAR(20)  DEFAULT 'active',
    rate_limit_config JSONB,
    created_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- Trading Pairs
CREATE TABLE trading_pairs (
    id           SERIAL        PRIMARY KEY,
    symbol       VARCHAR(20)   NOT NULL,
    base_asset   VARCHAR(10),
    quote_asset  VARCHAR(10),
    exchange_id  INT           NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
    is_active    BOOLEAN       DEFAULT true,
    min_qty      NUMERIC(24,8),
    tick_size    NUMERIC(24,8),
    UNIQUE (symbol, exchange_id)
);

CREATE INDEX idx_trading_pairs_symbol ON trading_pairs (symbol);
CREATE INDEX idx_trading_pairs_exchange_id ON trading_pairs (exchange_id);

-- ============================================================
-- OHLCV Hypertables
-- ============================================================

-- Helper: create an OHLCV table + hypertable + index
-- We create each individually for clarity.

-- ohlcv_1m
CREATE TABLE ohlcv_1m (
    time        TIMESTAMPTZ    NOT NULL,
    pair_id     INT            NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    exchange_id INT            NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
    open        NUMERIC(18,8)  NOT NULL,
    high        NUMERIC(18,8)  NOT NULL,
    low         NUMERIC(18,8)  NOT NULL,
    close       NUMERIC(18,8)  NOT NULL,
    volume      NUMERIC(24,8)  NOT NULL,
    trades      INT,
    PRIMARY KEY (time, pair_id, exchange_id)
);
SELECT create_hypertable('ohlcv_1m', 'time');
CREATE INDEX idx_ohlcv_1m_pair_time ON ohlcv_1m (pair_id, time DESC);

-- ohlcv_5m
CREATE TABLE ohlcv_5m (
    time        TIMESTAMPTZ    NOT NULL,
    pair_id     INT            NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    exchange_id INT            NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
    open        NUMERIC(18,8)  NOT NULL,
    high        NUMERIC(18,8)  NOT NULL,
    low         NUMERIC(18,8)  NOT NULL,
    close       NUMERIC(18,8)  NOT NULL,
    volume      NUMERIC(24,8)  NOT NULL,
    trades      INT,
    PRIMARY KEY (time, pair_id, exchange_id)
);
SELECT create_hypertable('ohlcv_5m', 'time');
CREATE INDEX idx_ohlcv_5m_pair_time ON ohlcv_5m (pair_id, time DESC);

-- ohlcv_15m
CREATE TABLE ohlcv_15m (
    time        TIMESTAMPTZ    NOT NULL,
    pair_id     INT            NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    exchange_id INT            NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
    open        NUMERIC(18,8)  NOT NULL,
    high        NUMERIC(18,8)  NOT NULL,
    low         NUMERIC(18,8)  NOT NULL,
    close       NUMERIC(18,8)  NOT NULL,
    volume      NUMERIC(24,8)  NOT NULL,
    trades      INT,
    PRIMARY KEY (time, pair_id, exchange_id)
);
SELECT create_hypertable('ohlcv_15m', 'time');
CREATE INDEX idx_ohlcv_15m_pair_time ON ohlcv_15m (pair_id, time DESC);

-- ohlcv_1h
CREATE TABLE ohlcv_1h (
    time        TIMESTAMPTZ    NOT NULL,
    pair_id     INT            NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    exchange_id INT            NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
    open        NUMERIC(18,8)  NOT NULL,
    high        NUMERIC(18,8)  NOT NULL,
    low         NUMERIC(18,8)  NOT NULL,
    close       NUMERIC(18,8)  NOT NULL,
    volume      NUMERIC(24,8)  NOT NULL,
    trades      INT,
    PRIMARY KEY (time, pair_id, exchange_id)
);
SELECT create_hypertable('ohlcv_1h', 'time');
CREATE INDEX idx_ohlcv_1h_pair_time ON ohlcv_1h (pair_id, time DESC);

-- ohlcv_4h
CREATE TABLE ohlcv_4h (
    time        TIMESTAMPTZ    NOT NULL,
    pair_id     INT            NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    exchange_id INT            NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
    open        NUMERIC(18,8)  NOT NULL,
    high        NUMERIC(18,8)  NOT NULL,
    low         NUMERIC(18,8)  NOT NULL,
    close       NUMERIC(18,8)  NOT NULL,
    volume      NUMERIC(24,8)  NOT NULL,
    trades      INT,
    PRIMARY KEY (time, pair_id, exchange_id)
);
SELECT create_hypertable('ohlcv_4h', 'time');
CREATE INDEX idx_ohlcv_4h_pair_time ON ohlcv_4h (pair_id, time DESC);

-- ohlcv_1d
CREATE TABLE ohlcv_1d (
    time        TIMESTAMPTZ    NOT NULL,
    pair_id     INT            NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    exchange_id INT            NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
    open        NUMERIC(18,8)  NOT NULL,
    high        NUMERIC(18,8)  NOT NULL,
    low         NUMERIC(18,8)  NOT NULL,
    close       NUMERIC(18,8)  NOT NULL,
    volume      NUMERIC(24,8)  NOT NULL,
    trades      INT,
    PRIMARY KEY (time, pair_id, exchange_id)
);
SELECT create_hypertable('ohlcv_1d', 'time');
CREATE INDEX idx_ohlcv_1d_pair_time ON ohlcv_1d (pair_id, time DESC);

-- ============================================================
-- Indicators (TimescaleDB hypertable)
-- ============================================================
CREATE TABLE indicators (
    time           TIMESTAMPTZ  NOT NULL,
    pair_id        INT          NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    timeframe      VARCHAR(5)   NOT NULL,
    indicator_name VARCHAR(50)  NOT NULL,
    value          JSONB        NOT NULL,
    PRIMARY KEY (time, pair_id, timeframe, indicator_name)
);
SELECT create_hypertable('indicators', 'time');
CREATE INDEX idx_indicators_pair_time ON indicators (pair_id, time DESC);

-- ============================================================
-- Signals
-- ============================================================
CREATE TABLE signals (
    id           UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    pair_id      INT             NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    exchange_id  INT             NOT NULL REFERENCES exchanges (id) ON DELETE CASCADE,
    strategy     VARCHAR(50)     NOT NULL,
    type         signal_type     NOT NULL,
    strength     signal_strength NOT NULL,
    entry_price  NUMERIC(18,8)   NOT NULL,
    stop_loss    NUMERIC(18,8),
    tp1          NUMERIC(18,8),
    tp2          NUMERIC(18,8),
    tp3          NUMERIC(18,8),
    confidence   NUMERIC(5,2),
    sources_json JSONB,
    reasoning    TEXT,
    timeframe    VARCHAR(5),
    status       signal_status   DEFAULT 'active',
    result_pnl   NUMERIC(10,2),
    created_at   TIMESTAMPTZ     DEFAULT NOW(),
    expires_at   TIMESTAMPTZ
);

CREATE INDEX idx_signals_pair_id ON signals (pair_id);
CREATE INDEX idx_signals_status ON signals (status);
CREATE INDEX idx_signals_created_at ON signals (created_at DESC);
CREATE INDEX idx_signals_strategy ON signals (strategy);

-- ============================================================
-- Alerts
-- ============================================================
CREATE TABLE alerts (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id           UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    name              VARCHAR(100),
    conditions_json   JSONB       NOT NULL,
    channels_json     JSONB       NOT NULL,
    is_active         BOOLEAN     DEFAULT true,
    cooldown_seconds  INT         DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user_id ON alerts (user_id);
CREATE INDEX idx_alerts_is_active ON alerts (is_active);

-- Alert History
CREATE TABLE alert_history (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id        UUID        NOT NULL REFERENCES alerts (id) ON DELETE CASCADE,
    triggered_at    TIMESTAMPTZ DEFAULT NOW(),
    snapshot_json   JSONB,
    delivery_status VARCHAR(20) DEFAULT 'sent'
);

CREATE INDEX idx_alert_history_alert_id ON alert_history (alert_id);
CREATE INDEX idx_alert_history_triggered_at ON alert_history (triggered_at DESC);

-- ============================================================
-- Watchlists
-- ============================================================
CREATE TABLE watchlists (
    user_id  UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    pair_id  INT         NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, pair_id)
);

-- ============================================================
-- Referrals
-- ============================================================
CREATE TABLE referrals (
    id            UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id   UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    referred_id   UUID          NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
    payment_id    UUID          REFERENCES payments (id) ON DELETE SET NULL,
    reward_amount NUMERIC(18,2),
    status        VARCHAR(20)   DEFAULT 'pending',
    created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX idx_referrals_referrer_id ON referrals (referrer_id);

-- ============================================================
-- Seed Data: Exchanges
-- ============================================================
INSERT INTO exchanges (name, api_base_url, ws_url) VALUES
    ('binance', 'https://api.binance.com', 'wss://stream.binance.com:9443'),
    ('bybit', 'https://api.bybit.com', 'wss://stream.bybit.com'),
    ('okx', 'https://www.okx.com', 'wss://ws.okx.com:8443');
