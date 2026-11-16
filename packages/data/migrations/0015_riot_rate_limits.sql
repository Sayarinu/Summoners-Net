-- Every Riot request reserves capacity here before it is sent, including retries and pages.
-- Riot limits apply per routing value (platform such as "euw1" or region such as "europe"):
-- an application limit across all methods, and a limit per method.
CREATE TABLE riot_request_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  region text NOT NULL,
  method text NOT NULL,
  requested_at timestamptz NOT NULL
);
CREATE INDEX riot_request_ledger_region ON riot_request_ledger(region, requested_at);
CREATE INDEX riot_request_ledger_method ON riot_request_ledger(region, method, requested_at);

-- Limits as last reported by X-App-Rate-Limit (method '') and X-Method-Rate-Limit headers.
CREATE TABLE riot_rate_limits (
  region text NOT NULL,
  method text NOT NULL,
  window_seconds integer NOT NULL CHECK (window_seconds > 0),
  limit_count integer NOT NULL CHECK (limit_count > 0),
  observed_at timestamptz NOT NULL,
  PRIMARY KEY (region, method, window_seconds)
);

-- A 429 pauses a region (method '') or one method in a region until Retry-After has passed.
CREATE TABLE riot_rate_pauses (
  region text NOT NULL,
  method text NOT NULL,
  until timestamptz NOT NULL,
  PRIMARY KEY (region, method)
);
