-- ============================================================
-- Confluence Score History (TimescaleDB hypertable)
--
-- Stores the Decision Confluence Engine output every 60 seconds
-- per trading pair, enabling backtesting and historical overlay.
-- ============================================================

CREATE TABLE IF NOT EXISTS confluence_history (
    time            TIMESTAMPTZ     NOT NULL,
    pair_id         INT             NOT NULL REFERENCES trading_pairs (id) ON DELETE CASCADE,
    symbol          VARCHAR(20)     NOT NULL,
    score           SMALLINT        NOT NULL CHECK (score BETWEEN 1 AND 100),
    label           VARCHAR(20)     NOT NULL,
    risk            VARCHAR(10)     NOT NULL,
    confidence      SMALLINT        NOT NULL,

    -- Component scores (1-100 each)
    trend_score     SMALLINT        NOT NULL,
    momentum_score  SMALLINT        NOT NULL,
    signals_score   SMALLINT        NOT NULL,
    sentiment_score SMALLINT        NOT NULL,
    volume_score    SMALLINT        NOT NULL,

    -- Full component details for deep analysis
    components_json JSONB,

    PRIMARY KEY (time, pair_id)
);

-- Convert to TimescaleDB hypertable (1-day chunks for efficient time-range queries)
SELECT create_hypertable('confluence_history', 'time', if_not_exists => TRUE);

-- Indexes for common query patterns
CREATE INDEX idx_confluence_pair_time ON confluence_history (pair_id, time DESC);
CREATE INDEX idx_confluence_symbol_time ON confluence_history (symbol, time DESC);
CREATE INDEX idx_confluence_score ON confluence_history (score DESC, time DESC);

-- Continuous aggregate: hourly average scores (for long-term charts)
CREATE MATERIALIZED VIEW IF NOT EXISTS confluence_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    pair_id,
    symbol,
    AVG(score)::SMALLINT AS avg_score,
    MIN(score)::SMALLINT AS min_score,
    MAX(score)::SMALLINT AS max_score,
    AVG(confidence)::SMALLINT AS avg_confidence,
    AVG(trend_score)::SMALLINT AS avg_trend,
    AVG(momentum_score)::SMALLINT AS avg_momentum,
    AVG(signals_score)::SMALLINT AS avg_signals,
    AVG(sentiment_score)::SMALLINT AS avg_sentiment,
    AVG(volume_score)::SMALLINT AS avg_volume,
    COUNT(*) AS sample_count
FROM confluence_history
GROUP BY bucket, pair_id, symbol
WITH NO DATA;

-- Retention policy: keep raw data for 30 days, hourly aggregates forever
SELECT add_retention_policy('confluence_history', INTERVAL '30 days', if_not_exists => TRUE);

-- Refresh policy for continuous aggregate: refresh hourly data every hour
SELECT add_continuous_aggregate_policy('confluence_hourly',
    start_offset => INTERVAL '3 hours',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);
