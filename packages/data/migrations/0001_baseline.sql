CREATE TABLE identities (
 id text PRIMARY KEY, kind text NOT NULL CHECK(kind IN ('team','player')), name text NOT NULL,
 source text NOT NULL, source_id text NOT NULL, document jsonb NOT NULL,
 UNIQUE(source,kind,source_id)
);
CREATE INDEX identities_kind_name ON identities(kind,lower(name),id);
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX identities_search ON identities USING gin(lower(name) gin_trgm_ops);
CREATE TABLE source_mappings(source text NOT NULL,kind text NOT NULL,external_id text NOT NULL,identity_id text NOT NULL REFERENCES identities(id),PRIMARY KEY(source,kind,external_id));
CREATE TABLE competitions(id text PRIMARY KEY,league text NOT NULL,name text NOT NULL,source text NOT NULL,source_id text NOT NULL);
CREATE TABLE matches(id text PRIMARY KEY,source_id text NOT NULL UNIQUE,competition_id text NOT NULL REFERENCES competitions(id),league text NOT NULL,starts_at timestamptz,state text NOT NULL,document jsonb NOT NULL);
CREATE INDEX matches_browse ON matches(league,starts_at DESC,id);
CREATE INDEX matches_status ON matches(state,starts_at DESC,id);
CREATE TABLE broadcasts(match_id text NOT NULL REFERENCES matches(id) ON DELETE CASCADE,provider text NOT NULL,external_id text NOT NULL,document jsonb NOT NULL,PRIMARY KEY(match_id,provider,external_id));
CREATE TABLE games(id text PRIMARY KEY,source_id text NOT NULL UNIQUE,match_id text REFERENCES matches(id),league text NOT NULL,year integer NOT NULL CHECK(year>=2014),occurred_at timestamptz NOT NULL,complete boolean NOT NULL,document jsonb NOT NULL,content_hash text NOT NULL);
CREATE INDEX games_browse ON games(year,league,occurred_at DESC,id);
CREATE INDEX games_recent ON games(occurred_at DESC,id);
CREATE INDEX games_match ON games(match_id);
CREATE TABLE participants(game_id text NOT NULL REFERENCES games(id) ON DELETE CASCADE,slot text NOT NULL,team_id text NOT NULL REFERENCES identities(id),player_id text REFERENCES identities(id),role text NOT NULL,champion text,won boolean,kills integer,deaths integer,assists integer,PRIMARY KEY(game_id,slot));
CREATE INDEX participants_team ON participants(team_id,game_id);
CREATE INDEX participants_player ON participants(player_id,game_id);
CREATE TABLE roster_observations(team_id text NOT NULL REFERENCES identities(id),player_id text NOT NULL REFERENCES identities(id),observed_at timestamptz NOT NULL,PRIMARY KEY(team_id,player_id,observed_at));
CREATE INDEX rosters_latest ON roster_observations(team_id,observed_at DESC);
CREATE TABLE roster_snapshots(team_id text PRIMARY KEY REFERENCES identities(id),observed_at timestamptz NOT NULL);
CREATE TABLE metadata(version text NOT NULL,kind text NOT NULL,document jsonb NOT NULL,PRIMARY KEY(version,kind));
CREATE TABLE source_status(source text PRIMARY KEY,last_success timestamptz,last_attempt timestamptz,error text,records integer NOT NULL DEFAULT 0);
INSERT INTO source_status(source) VALUES ('pandascore'),('oracle'),('ddragon');
CREATE TABLE imports(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,source text NOT NULL,file_hash text NOT NULL,year integer NOT NULL,records integer NOT NULL,imported_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sync_jobs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,job_key text NOT NULL,request jsonb NOT NULL,state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','running','done','failed')),requested_at timestamptz NOT NULL DEFAULT now(),available_at timestamptz NOT NULL DEFAULT now(),lease_until timestamptz,attempts integer NOT NULL DEFAULT 0,error text);
CREATE UNIQUE INDEX one_active_job ON sync_jobs(job_key) WHERE state IN ('queued','running');
CREATE INDEX jobs_ready ON sync_jobs(state,available_at,id);
CREATE TABLE sync_schedule(job_key text PRIMARY KEY,next_at timestamptz NOT NULL);
CREATE TABLE request_ledger(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,requested_at timestamptz NOT NULL);
CREATE INDEX request_rolling ON request_ledger(requested_at);
CREATE TABLE quota_state(id boolean PRIMARY KEY DEFAULT true CHECK(id),cooldown_until timestamptz);
INSERT INTO quota_state(id) VALUES(true);
