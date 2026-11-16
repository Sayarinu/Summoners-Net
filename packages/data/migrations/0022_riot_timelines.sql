-- match-v5 timelines: per-minute participant frames and timestamped events, keyed by the match
-- and participant ids from match ingestion. Coordinates and statistics Riot omits stay NULL.
ALTER TABLE riot_matches
  ADD COLUMN timeline_state text NOT NULL DEFAULT 'pending'
    CHECK (timeline_state IN ('pending', 'fetched', 'missing', 'invalid')),
  ADD COLUMN timeline_fetched_at timestamptz;
CREATE INDEX riot_matches_timeline_pending ON riot_matches(fetched_at, match_id)
  WHERE timeline_state = 'pending';

CREATE TABLE riot_timeline_frames (
  match_id text NOT NULL,
  participant_id integer NOT NULL,
  minute integer NOT NULL CHECK (minute >= 0),
  timestamp_ms integer NOT NULL,
  x integer,
  y integer,
  current_gold integer,
  total_gold integer,
  xp integer,
  level integer,
  minions_killed integer,
  jungle_minions_killed integer,
  PRIMARY KEY (match_id, participant_id, minute),
  FOREIGN KEY (match_id, participant_id) REFERENCES riot_match_participants ON DELETE CASCADE
);

-- Actor and victim reference match participants; Riot's id 0 (minions, towers) is stored NULL.
CREATE TABLE riot_timeline_events (
  match_id text NOT NULL REFERENCES riot_matches(match_id) ON DELETE CASCADE,
  seq integer NOT NULL,
  type text NOT NULL,
  timestamp_ms integer NOT NULL,
  participant_id integer,
  victim_id integer,
  team_id integer,
  x integer,
  y integer,
  item_id integer,
  after_item_id integer,
  skill_slot integer,
  level_up_type text,
  monster_type text,
  monster_sub_type text,
  building_type text,
  lane_type text,
  tower_type text,
  ward_type text,
  assisting_participant_ids integer[],
  PRIMARY KEY (match_id, seq),
  FOREIGN KEY (match_id, participant_id) REFERENCES riot_match_participants ON DELETE CASCADE,
  FOREIGN KEY (match_id, victim_id) REFERENCES riot_match_participants ON DELETE CASCADE
);
-- Per-participant reads (builds, skill orders) join participants by champion and matches by patch.
CREATE INDEX riot_timeline_events_participant ON riot_timeline_events(match_id, participant_id, type, timestamp_ms);
CREATE INDEX riot_timeline_events_type ON riot_timeline_events(type, match_id);
