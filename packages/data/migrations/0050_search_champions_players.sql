-- Search also finds champions by name and sampled solo-queue players by Riot ID ("Name#TAG").
CREATE INDEX catalog_champions_name_search ON catalog_champions USING gin(lower(name) gin_trgm_ops);
CREATE INDEX riot_accounts_riot_id_search ON riot_accounts
  USING gin(lower(game_name||'#'||tag_line) gin_trgm_ops)
  WHERE game_name IS NOT NULL AND tag_line IS NOT NULL;
