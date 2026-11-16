-- Successful apex-ladder observations. History starts here; current rows cannot reconstruct it.
CREATE TABLE riot_ladder_snapshots (
  snapshot_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  platform text NOT NULL,
  observed_at timestamptz NOT NULL
);
CREATE INDEX riot_ladder_snapshots_platform_time ON riot_ladder_snapshots(platform, observed_at DESC, snapshot_id DESC);
CREATE TABLE riot_ladder_snapshot_entries (
  snapshot_id bigint NOT NULL REFERENCES riot_ladder_snapshots ON DELETE CASCADE,
  puuid text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('CHALLENGER','GRANDMASTER','MASTER')),
  league_points integer NOT NULL CHECK (league_points >= 0),
  position integer NOT NULL CHECK (position > 0),
  PRIMARY KEY(snapshot_id, puuid)
);
CREATE INDEX riot_ladder_snapshot_entries_player ON riot_ladder_snapshot_entries(puuid, snapshot_id DESC);
