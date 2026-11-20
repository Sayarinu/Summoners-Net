-- Riot accounts by PUUID with their current Riot ID. A Riot ID is a display name only: accounts
-- are never linked by it. Every Riot ID an account has carried is kept in riot_account_names.
CREATE TABLE riot_accounts (
  puuid text PRIMARY KEY,
  game_name text,
  tag_line text,
  first_seen_at timestamptz NOT NULL,
  -- When Riot last returned this account, and when it was last asked.
  seen_at timestamptz NOT NULL,
  checked_at timestamptz NOT NULL
);
CREATE INDEX riot_accounts_checked ON riot_accounts(checked_at);

CREATE TABLE riot_account_names (
  puuid text NOT NULL REFERENCES riot_accounts(puuid),
  game_name text NOT NULL,
  tag_line text NOT NULL,
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  PRIMARY KEY (puuid, game_name, tag_line)
);
