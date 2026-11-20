CREATE TABLE map_images (
  map_id integer PRIMARY KEY,
  source_url text NOT NULL,
  asset_hash text NOT NULL REFERENCES image_assets(hash),
  fetched_at timestamptz NOT NULL
);
