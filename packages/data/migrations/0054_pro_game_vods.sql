-- Per-game recordings from Leaguepedia, keyed by the Riot game ID the Oracle archive shares.
CREATE TABLE pro_game_vods (
  source_game_id text PRIMARY KEY,
  checked_at timestamptz NOT NULL,
  -- When the links below were last seen; null until a usable link is found.
  observed_at timestamptz,
  leaguepedia_game_id text,
  game_start_url text,
  draft_start_url text,
  vod_url text
);
