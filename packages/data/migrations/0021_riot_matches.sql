-- Queued ids become fetched, missing (Riot answered 404) or invalid (the payload failed
-- validation and nothing was written).
-- match-v5 match details as normalized facts with Riot's identifiers. Statistics Riot omits stay
-- NULL. patch_key links game_version to the patch catalog and stays NULL for an unknown version.
ALTER TABLE riot_match_ids
  ADD COLUMN fetch_state text NOT NULL DEFAULT 'pending'
    CHECK (fetch_state IN ('pending', 'fetched', 'missing', 'invalid')),
  ADD COLUMN fetched_at timestamptz;
CREATE INDEX riot_match_ids_pending ON riot_match_ids(first_seen_at, match_id)
  WHERE fetch_state = 'pending';

CREATE TABLE riot_matches (
  match_id text PRIMARY KEY REFERENCES riot_match_ids(match_id),
  data_version text,
  platform_id text,
  queue_id integer,
  map_id integer,
  game_version text NOT NULL,
  patch_key text REFERENCES patches(patch_key),
  created_at timestamptz NOT NULL,
  started_at timestamptz,
  duration_seconds integer CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  end_of_game_result text,
  remake boolean,
  fetched_at timestamptz NOT NULL
);
CREATE INDEX riot_matches_patch ON riot_matches(patch_key, queue_id);
CREATE INDEX riot_matches_version ON riot_matches(game_version) WHERE patch_key IS NULL;

CREATE TABLE riot_match_teams (
  match_id text NOT NULL REFERENCES riot_matches(match_id) ON DELETE CASCADE,
  team_id integer NOT NULL CHECK (team_id IN (100, 200)),
  side text NOT NULL CHECK (side IN ('blue', 'red')),
  win boolean,
  PRIMARY KEY (match_id, team_id)
);
-- One row per objective Riot reports (baron, dragon, tower, horde, atakhan, ...).
CREATE TABLE riot_match_objectives (
  match_id text NOT NULL,
  team_id integer NOT NULL,
  objective text NOT NULL,
  first boolean,
  kills integer CHECK (kills IS NULL OR kills >= 0),
  PRIMARY KEY (match_id, team_id, objective),
  FOREIGN KEY (match_id, team_id) REFERENCES riot_match_teams ON DELETE CASCADE
);
CREATE TABLE riot_match_bans (
  match_id text NOT NULL,
  team_id integer NOT NULL,
  pick_turn integer NOT NULL,
  champion_id integer NOT NULL,
  PRIMARY KEY (match_id, team_id, pick_turn),
  FOREIGN KEY (match_id, team_id) REFERENCES riot_match_teams ON DELETE CASCADE
);

CREATE TABLE riot_match_participants (
  match_id text NOT NULL REFERENCES riot_matches(match_id) ON DELETE CASCADE,
  participant_id integer NOT NULL CHECK (participant_id BETWEEN 1 AND 10),
  puuid text NOT NULL,
  team_id integer NOT NULL CHECK (team_id IN (100, 200)),
  side text NOT NULL CHECK (side IN ('blue', 'red')),
  champion_id integer NOT NULL,
  champion_name text,
  team_position text,
  win boolean,
  kills integer,
  deaths integer,
  assists integer,
  champ_level integer,
  gold_earned integer,
  total_minions_killed integer,
  neutral_minions_killed integer,
  damage_to_champions integer,
  vision_score integer,
  summoner1_id integer,
  summoner2_id integer,
  stat_perk_defense integer,
  stat_perk_flex integer,
  stat_perk_offense integer,
  PRIMARY KEY (match_id, participant_id)
);
CREATE INDEX riot_match_participants_champion ON riot_match_participants(champion_id, match_id);
CREATE INDEX riot_match_participants_puuid ON riot_match_participants(puuid);

CREATE TABLE riot_match_items (
  match_id text NOT NULL,
  participant_id integer NOT NULL,
  slot integer NOT NULL CHECK (slot BETWEEN 0 AND 6),
  item_id integer NOT NULL,
  PRIMARY KEY (match_id, participant_id, slot),
  FOREIGN KEY (match_id, participant_id) REFERENCES riot_match_participants ON DELETE CASCADE
);
CREATE TABLE riot_match_perks (
  match_id text NOT NULL,
  participant_id integer NOT NULL,
  style text NOT NULL CHECK (style IN ('primary', 'sub')),
  slot integer NOT NULL CHECK (slot >= 0),
  style_id integer NOT NULL,
  perk_id integer NOT NULL,
  PRIMARY KEY (match_id, participant_id, style, slot),
  FOREIGN KEY (match_id, participant_id) REFERENCES riot_match_participants ON DELETE CASCADE
);

-- The validated payload, gzip-compressed, so aggregates can be rebuilt without refetching.
CREATE TABLE riot_match_payloads (
  match_id text PRIMARY KEY REFERENCES riot_matches(match_id) ON DELETE CASCADE,
  payload bytea NOT NULL,
  fetched_at timestamptz NOT NULL
);
