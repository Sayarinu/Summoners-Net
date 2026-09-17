CREATE INDEX games_text_search ON games USING gin(lower(document::text) gin_trgm_ops);
CREATE INDEX games_source_search ON games USING gin(lower(source_id) gin_trgm_ops);
CREATE INDEX matches_name_search ON matches USING gin(lower(document->>'name') gin_trgm_ops);
CREATE INDEX matches_text_search ON matches USING gin(lower(document::text) gin_trgm_ops);
CREATE INDEX matches_time ON matches(starts_at,id);
