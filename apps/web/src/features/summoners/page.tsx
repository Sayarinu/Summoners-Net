"use client";
import { ChampionIcon, EmptyState, LineChart, Pagination, Table, TextLink } from "@summonersnet/ui";
import { riotPlatforms, type SummonerProfile } from "@summonersnet/data/contracts";
import { useRouter } from "next/navigation";
import { dateTime } from "../browse/presentation";
export function SummonerPage({
  profile,
  error,
  puuid,
  timezone,
}: {
  profile: SummonerProfile | null;
  error: string | null;
  puuid: string;
  timezone: string;
}) {
  const router = useRouter();
  const base = `/summoners/${encodeURIComponent(puuid)}`;
  const name =
    profile?.gameName && profile.tagLine
      ? `${profile.gameName}#${profile.tagLine}`
      : "Riot ID not resolved";
  function go(key: "page" | "championPage", value: number) {
    const params = new URLSearchParams({
      page: String(profile!.query.page),
      championPage: String(profile!.query.championPage),
    });
    if (profile!.query.region) params.set("region", profile!.query.region);
    params.set(key, String(value));
    router.push(base + "?" + params.toString());
  }
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Solo queue player</span>
          <h1>{name}</h1>
          <p>
            Results and champion pool from retained ranked solo games. Missing statistics stay
            unknown.
          </p>
        </div>
      </header>
      <nav aria-label="Player regions" className="ev-filters">
        <TextLink href={base} aria-current={!profile?.query.region ? "page" : undefined}>
          All regions
        </TextLink>
        {riotPlatforms.map((r) => (
          <TextLink
            key={r}
            href={base + "?region=" + r}
            aria-current={profile?.query.region === r ? "page" : undefined}
          >
            {r.toUpperCase()}
          </TextLink>
        ))}
      </nav>
      {error ? (
        <p role="alert">{error}</p>
      ) : profile ? (
        <>
          <section className="np-stack" aria-label="Recent solo queue games">
            <h2>Recent games</h2>
            <Table
              caption="Recent ranked solo games"
              rows={profile.games.items}
              getRowKey={(r) => r.matchId}
              emptyMessage="No sampled games in this selection."
              columns={[
                { id: "date", header: "Played", render: (r) => dateTime(r.occurredAt, timezone) },
                { id: "match", header: "Match", render: (r) => r.matchId },
                {
                  id: "region",
                  header: "Region",
                  render: (r) => r.platform?.toUpperCase() ?? "Unknown",
                },
                { id: "patch", header: "Patch", render: (r) => r.patch ?? "Unknown" },
                {
                  id: "champion",
                  header: "Champion",
                  render: (r) => r.championName ?? `Champion ${r.championKey}`,
                },
                {
                  id: "result",
                  header: "Result",
                  render: (r) => (r.win === null ? "Unknown" : r.win ? "Win" : "Loss"),
                },
                {
                  id: "kda",
                  header: "K / D / A",
                  render: (r) => [r.kills, r.deaths, r.assists].map((v) => v ?? "?").join(" / "),
                },
                {
                  id: "duration",
                  header: "Minutes",
                  render: (r) =>
                    r.durationSeconds === null ? "Unknown" : (r.durationSeconds / 60).toFixed(1),
                },
              ]}
            />
            <p className="np-meta">
              {profile.games.total} sampled games · Page {profile.games.page}
            </p>
            <Pagination
              label="Recent game pages"
              currentPage={profile.games.page}
              totalPages={Math.max(1, Math.ceil(profile.games.total / 25))}
              onPageChange={(p) => go("page", p)}
            />
          </section>
          <section className="np-stack" aria-label="Champion pool">
            <h2>Champion pool</h2>
            <Table
              caption="Sampled champion pool"
              rows={profile.champions.items}
              getRowKey={(r) => String(r.championKey)}
              emptyMessage="No sampled champions in this selection."
              columns={[
                {
                  id: "champion",
                  header: "Champion",
                  render: (r) => (
                    <span className="ev-champion">
                      <ChampionIcon
                        id={r.championId ?? String(r.championKey)}
                        name={r.name ?? `Champion ${r.championKey}`}
                        imageUrl={r.imageUrl}
                        size="small"
                      />
                      {r.name ?? `Champion ${r.championKey}`}
                    </span>
                  ),
                },
                { id: "games", header: "Games", align: "end", render: (r) => r.games },
                {
                  id: "rate",
                  header: "Win rate",
                  align: "end",
                  render: (r) =>
                    r.winRate.value === null ? "Unknown" : `${(r.winRate.value * 100).toFixed(1)}%`,
                },
                {
                  id: "sample",
                  header: "Known results",
                  align: "end",
                  render: (r) => r.winRate.sampleCount,
                },
              ]}
            />
            <p className="np-meta">
              {profile.champions.total} champions · Page {profile.champions.page}
            </p>
            <Pagination
              label="Champion pool pages"
              currentPage={profile.champions.page}
              totalPages={Math.max(1, Math.ceil(profile.champions.total / 25))}
              onPageChange={(p) => go("championPage", p)}
            />
          </section>
          <section className="np-stack" aria-label="Ladder history">
            <h2>LP and rank history</h2>
            <p>
              Last 30 UTC days ({profile.historyFrom} to {profile.historyTo}). Each point uses the
              day's latest observed ladder position; the sample count is that day's observations.
              Missing days are gaps. Lower rank numbers are better.
            </p>
            <p className="np-meta">
              History starts with successful ladder refreshes after snapshot recording was enabled.
              Players outside the sampled apex ladder have no recorded position.
            </p>
            {profile.history.length ? (
              profile.history.map((h) => (
                <div key={h.platform} className="np-stack">
                  <h3>{h.platform.toUpperCase()}</h3>
                  <LineChart
                    title={`${h.platform.toUpperCase()} LP history`}
                    xLabel="Day in window"
                    yLabel="LP"
                    points={h.points.map((p, i) => ({
                      id: p.day,
                      label: p.day,
                      x: i + 1,
                      y: p.leaguePoints,
                      sampleCount: p.sampleCount,
                    }))}
                  />
                  <LineChart
                    title={`${h.platform.toUpperCase()} rank history`}
                    xLabel="Day in window"
                    yLabel="Rank"
                    points={h.points.map((p, i) => ({
                      id: p.day,
                      label: p.day,
                      x: i + 1,
                      y: p.rank,
                      sampleCount: p.sampleCount,
                    }))}
                  />
                </div>
              ))
            ) : (
              <EmptyState
                title="No ladder snapshots in this window"
                description="History appears after the local worker observes this player in a successful ladder refresh."
              />
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
