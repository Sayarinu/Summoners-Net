# Patch overview

`/patches/{major.minor}` accepts normalized stored patch keys; unknown or malformed keys return 404.
The page reads aggregate tables and local catalog metadata only. Every section returns at most ten
rows, selected and ranked in SQL. All sections share one database statement snapshot. Missing
samples produce explanations, never fabricated rates.

## Risers and fallers

The overview uses ranked solo queue (420), all roles, regions and tiers. Pick and win changes share
the [trending policy](trending.md): at least 50 trials and five observed successes and failures in
each patch, with absolute pooled two-proportion z greater than 1.96. Qualifying changes are ranked
by absolute percentage-point delta, then champion key and metric, separately for each direction. A
champion can appear for both metrics. Both rate denominators are displayed. The preceding patch is
the immediately preceding stored catalog patch, even when its aggregates are missing. The full
trending page offers source and role filters.

## New popular builds

A build is the first three completed items in purchase order (`champion_builds.kind = path`). Queue
420 observations are pooled across regions and tiers, grouped by champion and actual role. A path
qualifies when it has at least 50 current observations and is absent from the preceding patch's
sample of at least 50 complete cores for the same champion and role. One or more prior observations
disqualify it. An absent preceding sample cannot establish newness.

The current share denominator is all observed complete cores for that champion and role, not all
games or all available timelines. The page shows the current count and share, current sample, and
preceding core sample. New means newly observed in this comparison; it does not establish that the
build has never been played. Incomplete timeline coverage can hide older uses. The ten largest
current counts lead; champion key, role and ordered item IDs break ties.

## Pro presence

Presence is picks plus bans divided by stored complete pro drafts, pooled across leagues. Each
league's game count is counted once, even when repeated in many champion aggregate rows. The usual
sample policy requires ten drafts and flags samples below 50. Counts and rates show their draft
denominator. Champions with no observed presence or inconsistent counts are excluded. Leaders sort
by presence count, then champion key. This reflects stored draft coverage rather than every
professional game played on the patch.
