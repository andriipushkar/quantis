-- ============================================================
-- Google OAuth support
--
-- Adds OAuth provider tracking and Google ID to users table.
-- Makes password_hash nullable for OAuth-only accounts.
-- ============================================================

-- Auth provider enum
DO $$ BEGIN
    CREATE TYPE auth_provider AS ENUM ('local', 'google');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add OAuth columns
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_provider auth_provider DEFAULT 'local',
    ADD COLUMN IF NOT EXISTS google_id     VARCHAR(255)  UNIQUE,
    ADD COLUMN IF NOT EXISTS avatar_url    TEXT;

-- Make password_hash nullable (OAuth users don't have passwords)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Index for fast Google ID lookups during OAuth login
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;
