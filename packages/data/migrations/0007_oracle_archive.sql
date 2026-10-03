ALTER TABLE imports
  ADD COLUMN official_file_id text,
  ADD COLUMN official_url text,
  ADD COLUMN original_filename text,
  ADD COLUMN byte_length bigint,
  ADD COLUMN header text[],
  ADD COLUMN acquisition_method text CHECK (acquisition_method IN ('download','manual','upload')),
  ADD COLUMN source_rows integer,
  ADD COLUMN archive_games integer,
  ADD COLUMN eligible_games integer,
  ADD COLUMN duplicate_rows integer NOT NULL DEFAULT 0,
  ADD COLUMN first_game_at timestamptz,
  ADD COLUMN last_game_at timestamptz,
  ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN retained_file boolean NOT NULL DEFAULT false,
  ADD COLUMN retained_path text;

CREATE UNIQUE INDEX imports_oracle_artifact
  ON imports(source,year,file_hash) WHERE source='oracle';

CREATE TABLE oracle_archive_games (
  id text PRIMARY KEY,
  archive_year integer NOT NULL CHECK (archive_year >= 2014),
  source_league text NOT NULL,
  source_game_id text NOT NULL,
  occurred_at timestamptz NOT NULL,
  split text,
  playoffs boolean,
  game_number text,
  patch text,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  complete boolean NOT NULL,
  summary_eligible boolean NOT NULL,
  context jsonb NOT NULL,
  artifact_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(archive_year,source_league,source_game_id)
);

CREATE TABLE oracle_archive_participants (
  game_id text NOT NULL REFERENCES oracle_archive_games(id) ON DELETE CASCADE,
  slot text NOT NULL,
  participant_id text,
  side text NOT NULL CHECK(side IN ('blue','red')),
  position text NOT NULL,
  player_name text,
  player_source_id text,
  team_name text NOT NULL,
  team_source_id text,
  champion text,
  result boolean,
  kills double precision,
  deaths double precision,
  assists double precision,
  damage_to_champions double precision,
  vision_score double precision,
  total_gold double precision,
  total_cs double precision,
  statistics jsonb NOT NULL,
  draft jsonb NOT NULL,
  source_row jsonb NOT NULL,
  row_hash text NOT NULL,
  PRIMARY KEY(game_id,slot)
);

ALTER TABLE games ADD COLUMN archive_game_id text REFERENCES oracle_archive_games(id);
ALTER TABLE games DROP CONSTRAINT games_source_id_key;
CREATE INDEX games_source_id ON games(source_id);
CREATE UNIQUE INDEX games_archive_link ON games(archive_game_id) WHERE archive_game_id IS NOT NULL;

CREATE INDEX oracle_archive_games_year_time ON oracle_archive_games(archive_year,occurred_at DESC,id);
CREATE INDEX oracle_archive_games_league_time ON oracle_archive_games(source_league,occurred_at DESC,id);
CREATE INDEX oracle_archive_games_patch ON oracle_archive_games(patch,occurred_at DESC,id);
CREATE INDEX oracle_archive_participants_team ON oracle_archive_participants(lower(team_name),game_id);
CREATE INDEX oracle_archive_participants_player ON oracle_archive_participants(lower(player_name),game_id) WHERE player_name IS NOT NULL;
CREATE INDEX oracle_archive_participants_champion ON oracle_archive_participants(lower(champion),game_id) WHERE champion IS NOT NULL;
CREATE INDEX oracle_archive_participants_identity ON oracle_archive_participants(player_source_id,team_source_id,game_id);
