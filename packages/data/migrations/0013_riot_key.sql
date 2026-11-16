-- What the worker last observed about RIOT_API_KEY. The key itself is never stored: a short
-- SHA-256 fingerprint detects when it changes, and set_at records when the current key was first
-- seen, which dates the expiry reminder for development keys.
CREATE TABLE riot_key_status (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  configured boolean NOT NULL DEFAULT false,
  kind text CHECK (kind IN ('development', 'personal', 'production')),
  fingerprint text,
  set_at timestamptz,
  state text NOT NULL DEFAULT 'missing' CHECK (state IN ('missing', 'untested', 'valid', 'rejected')),
  checked_at timestamptz,
  detail text
);
INSERT INTO riot_key_status(id) VALUES (true);
