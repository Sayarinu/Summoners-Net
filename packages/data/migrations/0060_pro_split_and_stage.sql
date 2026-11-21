-- Pro statistics can be scoped by tournament split (Spring, Split 2, ...) and stage (regular
-- season or playoffs), from each archive game's own columns. The derived pro tables gain both in
-- their keys; a game without a recorded split or stage is kept under 'Unknown' / 'unknown'.
ALTER TABLE pro_champion_stats
  ADD COLUMN split text NOT NULL DEFAULT 'Unknown',
  ADD COLUMN stage text NOT NULL DEFAULT 'unknown'
    CHECK (stage IN ('regular', 'playoffs', 'unknown'));
ALTER TABLE pro_champion_stats DROP CONSTRAINT pro_champion_stats_pkey;
ALTER TABLE pro_champion_stats ADD PRIMARY KEY (patch_key, league, split, stage, champion_key);

ALTER TABLE pro_league_games
  ADD COLUMN split text NOT NULL DEFAULT 'Unknown',
  ADD COLUMN stage text NOT NULL DEFAULT 'unknown'
    CHECK (stage IN ('regular', 'playoffs', 'unknown'));
ALTER TABLE pro_league_games DROP CONSTRAINT pro_league_games_pkey;
ALTER TABLE pro_league_games ADD PRIMARY KEY (patch_key, league, split, stage);

ALTER TABLE pro_champion_performance
  ADD COLUMN split text NOT NULL DEFAULT 'Unknown',
  ADD COLUMN stage text NOT NULL DEFAULT 'unknown'
    CHECK (stage IN ('regular', 'playoffs', 'unknown'));
ALTER TABLE pro_champion_performance DROP CONSTRAINT pro_champion_performance_pkey;
ALTER TABLE pro_champion_performance
  ADD PRIMARY KEY (patch_key, league, split, stage, role, champion_key);

ALTER TABLE pro_unmapped_drafts
  ADD COLUMN split text NOT NULL DEFAULT 'Unknown',
  ADD COLUMN stage text NOT NULL DEFAULT 'unknown'
    CHECK (stage IN ('regular', 'playoffs', 'unknown'));
ALTER TABLE pro_unmapped_drafts DROP CONSTRAINT pro_unmapped_drafts_pkey;
ALTER TABLE pro_unmapped_drafts ADD PRIMARY KEY (patch_key, league, split, stage, name);

-- Every pro patch is rebuilt with the new keys; until then its rows count under 'Unknown'.
INSERT INTO aggregate_dirty(source, patch_key, marked_at)
SELECT DISTINCT 'pro', patch_key, now() FROM pro_champion_stats
ON CONFLICT DO NOTHING;
