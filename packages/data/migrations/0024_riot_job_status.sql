-- Riot jobs report here rather than in source_status: the last success, the last error and when
-- it happened, per job kind.
CREATE TABLE riot_job_status (
  kind text PRIMARY KEY,
  last_success timestamptz,
  last_error_at timestamptz,
  error text,
  records integer NOT NULL DEFAULT 0
);
