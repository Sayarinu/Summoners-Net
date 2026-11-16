-- Win probability features per solo-queue match and minute, from blue side's point of view,
-- computed from stored frames and events. version names the feature definition; differences
-- are NULL when any participant's frame is missing for that minute.
CREATE TABLE riot_wp_features (
  match_id text NOT NULL REFERENCES riot_matches(match_id) ON DELETE CASCADE,
  version integer NOT NULL,
  minute integer NOT NULL CHECK (minute >= 0),
  timestamp_ms integer NOT NULL,
  gold_diff integer,
  xp_diff integer,
  cs_diff integer,
  blue_kills integer NOT NULL,
  red_kills integer NOT NULL,
  blue_towers integer NOT NULL,
  red_towers integer NOT NULL,
  blue_inhibitors integer NOT NULL,
  red_inhibitors integer NOT NULL,
  blue_barons integer NOT NULL,
  red_barons integer NOT NULL,
  blue_elders integer NOT NULL,
  red_elders integer NOT NULL,
  -- Dragons by type, such as {"FIRE_DRAGON": 1}.
  blue_dragons jsonb NOT NULL,
  red_dragons jsonb NOT NULL,
  blue_soul boolean NOT NULL,
  red_soul boolean NOT NULL,
  blue_win boolean,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY (match_id, version, minute)
);
CREATE INDEX riot_wp_features_version ON riot_wp_features(version, match_id);
