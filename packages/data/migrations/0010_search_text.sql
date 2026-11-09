-- Browse and profile filters match the string and number values a reader sees in a game or
-- match. The previous expression index covered lower(document::text), so every JSON key and
-- punctuation mark became trigram noise: a search such as "player" or "won" matched every row,
-- and each candidate re-serialized the whole document during the index recheck. A stored,
-- lower-cased value list keeps the trigram index selective and the recheck cheap.
ALTER TABLE games ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(
    jsonb_path_query_array(
      document,
      'strict $.** ? (@.type() == "string" || @.type() == "number")'
    )::text
  )
) STORED;
ALTER TABLE matches ADD COLUMN search_text text GENERATED ALWAYS AS (
  lower(
    jsonb_path_query_array(
      document,
      'strict $.** ? (@.type() == "string" || @.type() == "number")'
    )::text
  )
) STORED;

DROP INDEX games_text_search;
DROP INDEX matches_text_search;
CREATE INDEX games_search_text ON games USING gin(search_text gin_trgm_ops);
CREATE INDEX matches_search_text ON matches USING gin(search_text gin_trgm_ops);
