-- Win probability added (WPA) per kill and objective event, scored with one model. The value
-- is the credited side's change in win probability with the economy held fixed; participants
-- share it under the rule in domain/wpa.ts. Rescoring with a model replaces only its own rows.
CREATE TABLE riot_wpa_events (
  match_id text NOT NULL REFERENCES riot_matches(match_id) ON DELETE CASCADE,
  seq integer NOT NULL,
  model_id bigint NOT NULL REFERENCES wp_models(id) ON DELETE CASCADE,
  type text NOT NULL,
  timestamp_ms integer NOT NULL,
  team text CHECK (team IN ('blue', 'red')),
  delta double precision,
  computed_at timestamptz NOT NULL,
  PRIMARY KEY (match_id, seq, model_id)
);
CREATE INDEX riot_wpa_events_model ON riot_wpa_events(model_id, match_id);

CREATE TABLE riot_wpa_participants (
  match_id text NOT NULL,
  seq integer NOT NULL,
  model_id bigint NOT NULL,
  participant_id integer NOT NULL,
  role text NOT NULL CHECK (role IN ('killer', 'taker', 'assister', 'victim')),
  value double precision NOT NULL,
  PRIMARY KEY (match_id, seq, model_id, participant_id, role),
  FOREIGN KEY (match_id, seq, model_id) REFERENCES riot_wpa_events ON DELETE CASCADE
);
CREATE INDEX riot_wpa_participants_player ON riot_wpa_participants(model_id, match_id, participant_id);
