"use client";
import { ChampionIcon, EmptyState, Pagination, Table, TextLink } from "@summonersnet/ui";
import { riotPlatforms, type Leaderboard } from "@summonersnet/data/contracts";
import { useRouter } from "next/navigation";
import { dateTime } from "../browse/presentation";
export function LeaderboardPage({
  list,
  error,
  region,
  timezone,
}: {
  list: Leaderboard | null;
  error: string | null;
  region: string;
  timezone: string;
}) {
  const router = useRouter();
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Solo queue</span>
          <h1>{region.toUpperCase()} leaderboard</h1>
          <p>Challenger, Grandmaster and Master, ordered by tier and LP.</p>
        </div>
      </header>
      <nav aria-label="Ladder regions" className="ev-filters">
        {riotPlatforms.map((r) => (
          <TextLink
            key={r}
            href={`/leaderboards/${r}`}
            aria-current={r === region ? "page" : undefined}
          >
            {r.toUpperCase()}
          </TextLink>
        ))}
      </nav>
      {error ? (
        <p role="alert">{error}</p>
      ) : !list?.lastSuccess ? (
        <EmptyState
          title="No ladder stored for this region"
          description={
            <span>
              Enable this region in the local worker and refresh its ladder from{" "}
              <TextLink href="/sources">Sources</TextLink>.
            </span>
          }
        />
      ) : (
        <section className="np-stack" aria-label="Regional ladder">
          <p className="np-meta">
            Last refreshed {dateTime(list.lastSuccess, timezone)}. Champion samples cover retained
            ranked solo games in this region, across patches; they are not the full season.
          </p>
          {list.refreshFailed ? (
            <p role="status">
              The last refresh failed
              {list.lastAttempt ? ` at ${dateTime(list.lastAttempt, timezone)}` : ""}. Showing the
              previous successful ladder.
            </p>
          ) : null}
          <Table
            caption={`${region.toUpperCase()} solo queue ladder`}
            rows={list.page.items}
            getRowKey={(r) => r.puuid}
            emptyMessage="No ladder entries on this page."
            columns={[
              { id: "rank", header: "Rank", align: "end", render: (r) => r.rank },
              {
                id: "name",
                header: "Riot ID",
                render: (r) =>
                  r.gameName && r.tagLine ? `${r.gameName}#${r.tagLine}` : "Riot ID not resolved",
              },
              { id: "tier", header: "Tier", render: (r) => r.tier },
              { id: "lp", header: "LP", align: "end", render: (r) => r.leaguePoints },
              { id: "wins", header: "Wins", align: "end", render: (r) => r.wins },
              { id: "losses", header: "Losses", align: "end", render: (r) => r.losses },
              {
                id: "rate",
                header: "Win rate",
                align: "end",
                render: (r) => (
                  <span>
                    {r.winRate.value === null
                      ? "Unknown"
                      : `${(100 * r.winRate.value).toFixed(1)}%`}{" "}
                    · {r.winRate.sampleCount} games
                  </span>
                ),
              },
              {
                id: "champions",
                header: "Most played",
                render: (r) =>
                  r.champions.length ? (
                    <div className="np-stack">
                      {r.champions.map((c) => (
                        <span key={c.championKey} className="ev-champion">
                          <ChampionIcon
                            id={c.championId ?? String(c.championKey)}
                            name={c.name ?? `Champion ${c.championKey}`}
                            imageUrl={c.imageUrl}
                            size="small"
                          />
                          {c.name ?? `Champion ${c.championKey}`} · {c.games}{" "}
                          {c.games === 1 ? "game" : "games"}
                        </span>
                      ))}
                      <span className="np-meta">{r.sampledGames} sampled games</span>
                    </div>
                  ) : (
                    "No sampled games"
                  ),
              },
            ]}
          />
          <div className="ev-pagination">
            <span className="np-meta">
              {list.page.total} players · Page {list.page.page}
            </span>
            <Pagination
              label="Ladder pages"
              currentPage={list.page.page}
              totalPages={Math.max(1, Math.ceil(list.page.total / list.page.pageSize))}
              onPageChange={(page) =>
                router.push(`/leaderboards/${region}?page=${page}&pageSize=${list.page.pageSize}`)
              }
            />
          </div>
        </section>
      )}
    </div>
  );
}
