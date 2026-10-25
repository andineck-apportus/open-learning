CREATE TABLE IF NOT EXISTS oauth_states (id TEXT PRIMARY KEY, challenge TEXT NOT NULL, verifier TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_tickets (id TEXT PRIMARY KEY, challenge TEXT NOT NULL, refresh_cipher TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS oauth_sessions (id TEXT PRIMARY KEY, refresh_cipher TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS states_expiry ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS tickets_expiry ON oauth_tickets(expires_at);
CREATE INDEX IF NOT EXISTS sessions_expiry ON oauth_sessions(expires_at);
