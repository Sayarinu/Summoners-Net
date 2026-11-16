-- Apex-tier ranked solo queue entries per platform, keyed by Riot's PUUID. A platform's entries
-- are written only after its three tiers all fetch and validate. Entries absent from a newer
-- ladder are kept with their last fetch time; the current ladder is the rows fetched at the
-- platform's last success. A failed platform keeps its last ladder and timestamps.
CREATE TABLE riot_ladder_entries (
  platform text NOT NULL,
  queue text NOT NULL,
  puuid text NOT NULL,
  summoner_id text,
  tier text NOT NULL CHECK (tier IN ('CHALLENGER', 'GRANDMASTER', 'MASTER')),
  rank text NOT NULL,
  league_points integer NOT NULL CHECK (league_points >= 0),
  wins integer NOT NULL CHECK (wins >= 0),
  losses integer NOT NULL CHECK (losses >= 0),
  league_id text NOT NULL,
  fetched_at timestamptz NOT NULL,
  PRIMARY KEY (platform, queue, puuid)
);
CREATE INDEX riot_ladder_entries_rank ON riot_ladder_entries(platform, queue, league_points DESC);

CREATE TABLE riot_ladder_status (
  platform text PRIMARY KEY,
  last_success timestamptz,
  last_attempt timestamptz,
  entries integer NOT NULL DEFAULT 0,
  error text
);
