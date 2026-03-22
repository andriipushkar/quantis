-- Persistence for 7 features previously using in-memory Map storage

-- 1. Trading Journal
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pair VARCHAR(20) NOT NULL,
    direction VARCHAR(5) NOT NULL CHECK (direction IN ('long', 'short')),
    entry_price NUMERIC(18,8) NOT NULL,
    exit_price NUMERIC(18,8),
    size NUMERIC(18,8) NOT NULL,
    strategy VARCHAR(100),
    emotional_state VARCHAR(20) CHECK (emotional_state IN ('calm', 'fomo', 'revenge', 'greedy', 'fearful')),
    notes TEXT,
    confidence INT CHECK (confidence IS NULL OR (confidence >= 1 AND confidence <= 5)),
    timeframe VARCHAR(10),
    pnl NUMERIC(18,8),
    pnl_pct NUMERIC(18,8),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at DESC);

-- 2. Social Posts
CREATE TABLE IF NOT EXISTS social_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('trade_idea', 'analysis', 'comment')),
    content TEXT NOT NULL,
    symbol VARCHAR(20),
    direction VARCHAR(10) CHECK (direction IN ('bullish', 'bearish', 'neutral')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_posts_created_at ON social_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_posts_symbol ON social_posts(symbol);

-- 3. Social Likes (join table)
CREATE TABLE IF NOT EXISTS social_likes (
    post_id UUID NOT NULL REFERENCES social_posts(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    PRIMARY KEY (post_id, user_id)
);

-- 4. User Gamification
CREATE TABLE IF NOT EXISTS user_gamification (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    total_xp INT NOT NULL DEFAULT 0,
    streak_days INT NOT NULL DEFAULT 1,
    last_login_date DATE NOT NULL DEFAULT CURRENT_DATE,
    action_counts JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS gamification_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    xp INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gamification_history_user_id ON gamification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_gamification_history_created_at ON gamification_history(created_at DESC);

-- 5. Copy Trading Relationships
CREATE TABLE IF NOT EXISTS copy_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leader_id VARCHAR(20) NOT NULL,
    allocation NUMERIC(18,2) NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (follower_id, leader_id)
);

CREATE INDEX IF NOT EXISTS idx_copy_relationships_follower ON copy_relationships(follower_id);

-- 6. DCA Bots
CREATE TABLE IF NOT EXISTS dca_bots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    base_amount NUMERIC(18,8) NOT NULL,
    interval VARCHAR(10) NOT NULL CHECK (interval IN ('daily', 'weekly')),
    strategy VARCHAR(20) NOT NULL CHECK (strategy IN ('standard', 'rsi_weighted', 'fear_greed')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dca_bots_user_id ON dca_bots(user_id);

-- 7. Marketplace Strategies
CREATE TABLE IF NOT EXISTS marketplace_strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id VARCHAR(100) NOT NULL,
    author_name VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('trend', 'mean_reversion', 'breakout', 'scalp')),
    win_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_return NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_drawdown NUMERIC(10,2) NOT NULL DEFAULT 0,
    sharpe_ratio NUMERIC(5,2) NOT NULL DEFAULT 0,
    followers_count INT NOT NULL DEFAULT 0,
    price NUMERIC(10,2),
    timeframe VARCHAR(10) NOT NULL,
    pairs TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_strategies_type ON marketplace_strategies(type);

-- Marketplace strategy ratings (join table)
CREATE TABLE IF NOT EXISTS marketplace_ratings (
    strategy_id UUID NOT NULL REFERENCES marketplace_strategies(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    PRIMARY KEY (strategy_id, user_id)
);

-- Marketplace strategy followers (join table)
CREATE TABLE IF NOT EXISTS marketplace_followers (
    strategy_id UUID NOT NULL REFERENCES marketplace_strategies(id) ON DELETE CASCADE,
    user_id VARCHAR(100) NOT NULL,
    PRIMARY KEY (strategy_id, user_id)
);

-- 8. Tracked Wallets
CREATE TABLE IF NOT EXISTS tracked_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(200) NOT NULL,
    chain VARCHAR(20) NOT NULL CHECK (chain IN ('ethereum', 'solana', 'bitcoin')),
    label VARCHAR(100),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, address, chain)
);

CREATE INDEX IF NOT EXISTS idx_tracked_wallets_user_id ON tracked_wallets(user_id);

-- Seed mock social posts
INSERT INTO social_posts (id, user_id, user_name, type, content, symbol, direction, created_at) VALUES
  (gen_random_uuid(), 'user-mock-1', 'CryptoAlpha', 'trade_idea', 'BTC forming a classic bull flag on the 4H chart. Expecting a breakout above 71k with targets at 73.5k. Stop below 69.2k. Risk/reward is 2.8:1.', 'BTCUSDT', 'bullish', NOW() - INTERVAL '15 minutes'),
  (gen_random_uuid(), 'user-mock-2', 'DeFiWhale', 'analysis', 'ETH/BTC ratio hitting multi-month support at 0.046. Historically this level has held 4 times in the past year. If it breaks, could see ETH underperformance accelerate toward 0.042.', 'ETHUSDT', 'neutral', NOW() - INTERVAL '45 minutes'),
  (gen_random_uuid(), 'user-mock-3', 'SwingMaster_X', 'trade_idea', 'SOL breaking out of the descending wedge on daily. Volume confirming. Entered long at 142 with TP at 165 and SL at 134. Strong conviction play.', 'SOLUSDT', 'bullish', NOW() - INTERVAL '2 hours'),
  (gen_random_uuid(), 'user-mock-4', 'QuantBot_v2', 'analysis', 'On-chain data shows whale wallets accumulating LINK aggressively over the past 72h. Top 100 wallets increased holdings by 4.2M tokens. Oracle narrative heating up.', 'LINKUSDT', 'bullish', NOW() - INTERVAL '3 hours'),
  (gen_random_uuid(), 'user-mock-5', 'NarrativeHunter', 'comment', 'Market feels overextended after 3 consecutive green weeks. Fear & Greed at 78. Taking some profit on alts and rotating into stables. Will re-enter on any meaningful pullback to the 20-day EMA.', NULL, NULL, NOW() - INTERVAL '4 hours'),
  (gen_random_uuid(), 'user-mock-6', 'GridGuru', 'trade_idea', 'DOGE showing a classic range between 0.14 and 0.17 for the past 10 days. Running a grid bot with 15 levels. Collecting 0.3-0.5% per grid. Perfect for the current low-vol environment.', 'DOGEUSDT', 'neutral', NOW() - INTERVAL '5 hours'),
  (gen_random_uuid(), 'user-mock-7', 'SteadyEddie', 'analysis', 'BTC dominance breaking above 54% resistance. This typically signals an alt-season cooldown. Historically, BTC.D above 55% has led to 2-4 weeks of alt underperformance. Staying BTC-heavy for now.', 'BTCUSDT', 'bullish', NOW() - INTERVAL '7 hours'),
  (gen_random_uuid(), 'user-mock-8', 'MoonShot_Pro', 'trade_idea', 'AVAX looks weak. Head and shoulders forming on the daily with neckline at 32.50. If it breaks, measured move targets 26. Shorting with tight risk above 35.', 'AVAXUSDT', 'bearish', NOW() - INTERVAL '8 hours'),
  (gen_random_uuid(), 'user-mock-1', 'CryptoAlpha', 'comment', 'Funding rates across the board are turning negative after the flush. This is actually constructive for longs — the market has reset leverage. Watch for a sharp bounce in the next 24-48h.', NULL, NULL, NOW() - INTERVAL '10 hours'),
  (gen_random_uuid(), 'user-mock-3', 'SwingMaster_X', 'analysis', 'XRP cleared the 0.62 resistance with massive volume. This was a multi-month consolidation breakout. Next major resistance at 0.74. Pullbacks to 0.62 are a buy zone now.', 'XRPUSDT', 'bullish', NOW() - INTERVAL '12 hours')
ON CONFLICT DO NOTHING;

-- Seed mock marketplace strategies
INSERT INTO marketplace_strategies (id, author_id, author_name, name, description, type, win_rate, total_return, max_drawdown, sharpe_ratio, followers_count, price, timeframe, pairs, created_at) VALUES
  ('00000000-0000-4000-8000-000000000001', 'user-m-1', 'CryptoAlpha', 'Golden Cross Momentum', 'Trend-following strategy using 50/200 EMA crossover with volume confirmation. Optimized for 4H charts on major pairs.', 'trend', 62, 145.3, 18.2, 1.85, 342, NULL, '4H', ARRAY['BTCUSDT','ETHUSDT','SOLUSDT'], NOW() - INTERVAL '90 days'),
  ('00000000-0000-4000-8000-000000000002', 'user-m-2', 'QuantDegen', 'Bollinger Mean Revert', 'Mean reversion on Bollinger Band extremes with RSI divergence filter. Best for ranging markets.', 'mean_reversion', 71, 89.7, 12.5, 2.1, 218, 29, '1H', ARRAY['BTCUSDT','ETHUSDT','BNBUSDT','XRPUSDT'], NOW() - INTERVAL '60 days'),
  ('00000000-0000-4000-8000-000000000003', 'user-m-3', 'AlgoWizard', 'Range Breakout Pro', 'Detects consolidation ranges and trades confirmed breakouts with tight stop losses. High R:R ratio.', 'breakout', 48, 200.1, 24.8, 1.55, 507, 49, '15m', ARRAY['BTCUSDT','ETHUSDT'], NOW() - INTERVAL '120 days'),
  ('00000000-0000-4000-8000-000000000004', 'user-m-4', 'ScalpKing', 'Micro Scalp Machine', 'High-frequency scalping on 1m charts using order flow imbalance and VWAP bounces.', 'scalp', 78, 67.2, 8.1, 2.45, 891, 99, '1m', ARRAY['BTCUSDT','ETHUSDT','SOLUSDT','DOGEUSDT'], NOW() - INTERVAL '45 days'),
  ('00000000-0000-4000-8000-000000000005', 'user-m-5', 'OnChainSage', 'DeFi Narrative Surfer', 'Trend strategy that tracks DeFi narrative rotations using social sentiment and on-chain TVL shifts.', 'trend', 55, 178.5, 31.2, 1.32, 156, NULL, '1D', ARRAY['AAVEUSDT','UNIUSDT','LINKUSDT','MKRUSDT'], NOW() - INTERVAL '150 days'),
  ('00000000-0000-4000-8000-000000000006', 'user-m-6', 'SteadyEddie', 'RSI Reversion Engine', 'Enters positions when RSI hits extreme levels with MACD histogram confirmation. Conservative sizing.', 'mean_reversion', 66, 42.8, 9.3, 1.92, 274, 19, '4H', ARRAY['BTCUSDT','ETHUSDT','ADAUSDT'], NOW() - INTERVAL '75 days'),
  ('00000000-0000-4000-8000-000000000007', 'user-m-7', 'VolTrader', 'Volatility Squeeze Play', 'Identifies low-volatility squeezes using Keltner channels and Bollinger Bands, trading the expansion.', 'breakout', 52, -5.3, 22.7, 0.45, 43, NULL, '1H', ARRAY['BTCUSDT','ETHUSDT','AVAXUSDT','DOTUSDT'], NOW() - INTERVAL '30 days'),
  ('00000000-0000-4000-8000-000000000008', 'user-m-8', 'PerpGuru', 'Funding Rate Scalper', 'Scalps perpetual futures based on extreme funding rate deviations and open interest divergences.', 'scalp', 69, 112.6, 14.9, 1.78, 419, 39, '5m', ARRAY['BTCUSDT','ETHUSDT','SOLUSDT'], NOW() - INTERVAL '55 days')
ON CONFLICT DO NOTHING;
