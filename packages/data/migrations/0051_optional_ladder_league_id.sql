-- Riot's apex league responses no longer include a league id; entries keep it only when returned.
ALTER TABLE riot_ladder_entries ALTER COLUMN league_id DROP NOT NULL;
