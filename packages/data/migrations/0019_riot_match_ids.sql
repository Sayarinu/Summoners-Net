-- Ranked solo queue match ids from match-v5, stored once whichever ladder player surfaced them.
-- crawl_patch_key is the newest catalog patch when the id was crawled; it bounds the sample per
-- region and patch. Match details record the game's actual patch.
CREATE TABLE riot_match_ids (
  match_id text PRIMARY KEY,
  region text NOT NULL,
  platform text NOT NULL,
  crawl_patch_key text NOT NULL REFERENCES patches(patch_key),
  first_seen_at timestamptz NOT NULL,
  first_seen_puuid text NOT NULL
);
CREATE INDEX riot_match_ids_cap ON riot_match_ids(region, crawl_patch_key);

-- Crawl progress per ladder player, so an interrupted crawl resumes and later crawls ask only for
-- matches played since the last one.
CREATE TABLE riot_match_crawl (
  puuid text PRIMARY KEY,
  platform text NOT NULL,
  crawled_at timestamptz NOT NULL,
  ids_seen integer NOT NULL CHECK (ids_seen >= 0)
);
CREATE INDEX riot_match_crawl_due ON riot_match_crawl(crawled_at);
