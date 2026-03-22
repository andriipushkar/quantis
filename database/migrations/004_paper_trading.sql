-- Paper Trading Persistence
CREATE TABLE IF NOT EXISTS paper_accounts (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance NUMERIC(18,8) NOT NULL DEFAULT 10000,
    equity NUMERIC(18,8) NOT NULL DEFAULT 10000,
    realized_pnl NUMERIC(18,8) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS paper_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(5) NOT NULL CHECK (side IN ('long', 'short')),
    quantity NUMERIC(18,8) NOT NULL,
    entry_price NUMERIC(18,8) NOT NULL,
    current_price NUMERIC(18,8),
    unrealized_pnl NUMERIC(18,8) DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, symbol, side)
);

CREATE TABLE IF NOT EXISTS paper_trades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(5) NOT NULL,
    quantity NUMERIC(18,8) NOT NULL,
    entry_price NUMERIC(18,8) NOT NULL,
    exit_price NUMERIC(18,8),
    pnl NUMERIC(18,8),
    pnl_percent NUMERIC(10,4),
    opened_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_positions_user ON paper_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_paper_trades_user ON paper_trades(user_id, closed_at DESC);
