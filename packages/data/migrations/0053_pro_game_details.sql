CREATE TABLE pro_game_details (
  source_game_id text PRIMARY KEY,
  checked_at timestamptz NOT NULL,
  observed_at timestamptz,
  document jsonb
);

CREATE INDEX oracle_archive_games_pro_details_idx
  ON oracle_archive_games(occurred_at DESC, source_game_id)
  WHERE complete AND source_game_id ~ '^(LOL|ESPORTS)TMNT[0-9]{2}_[0-9]+$';
