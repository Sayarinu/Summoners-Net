# Champion ladder players

The solo-queue champion page lists accounts in the last successful Challenger, Grandmaster or Master
ladder snapshot, using retained ranked solo (queue 420), non-remake matches for the selected patch
and role. A player needs at least ten sampled champion games to appear. Win rate uses known results
only and remains unknown below ten known results; its count is displayed. These samples describe
stored games, not a player's complete match history or true skill.

Counts belong to an account and platform together. The region filter uses the match's stored routing
region. The tier filter uses the player's current stored ladder tier; this can differ from the
collection-tier slice used by the general champion aggregates. Rank shows tier, LP, platform and
observation date from the last successful ladder snapshot. A failed refresh keeps that snapshot;
accounts absent from a subsequent successful snapshot no longer appear.

Sorting and pagination happen in SQL, with twenty rows per page and at most 1,000 pages. Games sort
descending, then observed win rate; win-rate sorting puts known rates first, then games. Account and
platform identifiers break ties. Counts and rows share one statement snapshot.

Account links open the platform-filtered solo profile. Imported pro links decorate accounts with
their corroborated canonical identity and public profile route; names alone never establish a link.
Queries use stored facts and metadata and make no provider requests.
