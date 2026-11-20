"use client";
import { ChampionPortrait, GameResult, type ChampionPortraits } from "../browse/visuals";
import {
  ChampionIcon,
  EmptyState,
  LineChart,
  PageHeader,
  Pagination,
  Panel,
  TabNav,
  Table,
  TextLink,
} from "@summonersnet/ui";
import { riotPlatforms, type SummonerProfile } from "@summonersnet/data/contracts";
import { useRouter } from "next/navigation";
import { dateTime } from "../browse/presentation";
export function SummonerPage({
  profile,
  error,
  puuid,
  timezone,
  portraits,
}: {
  profile: SummonerProfile | null;
  error: string | null;
  puuid: string;
  timezone: string;
  portraits?: ChampionPortraits;
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
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader
        eyebrow="Solo Queue"
        title={name}
        actions={
          <TextLink href={`/heatmaps?subjectKind=player&subject=${encodeURIComponent(puuid)}`}>
            Heatmaps
          </TextLink>
        }
      />
      <div className="overflow-x-auto border-y border-line py-3">
        <TabNav
          label="Player Regions"
          variant="segmented"
          className="w-max"
          items={[
            { href: base, label: "All Regions", current: !profile?.query.region },
            ...riotPlatforms.map((r) => ({
              href: base + "?region=" + r,
              label: r.toUpperCase(),
              current: profile?.query.region === r,
            })),
          ]}
        />
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : profile ? (
        <>
          <Panel aria-label="Recent Solo Queue Games" title="Recent Games" padding="none">
            <Table
              caption="Recent Ranked Solo Games"
              rows={profile.games.items}
              getRowKey={(r) => r.matchId}
              emptyMessage="No sampled games in this selection."
              columns={[
                { id: "date", header: "Played", render: (r) => dateTime(r.occurredAt, timezone) },
                {
                  id: "match",
                  header: "Match",
                  render: (r) => <TextLink href={`/solo-games/${r.matchId}`}>{r.matchId}</TextLink>,
                },
                {
                  id: "region",
                  header: "Region",
                  render: (r) => r.platform?.toUpperCase() ?? "Unknown",
                },
                { id: "patch", header: "Patch", render: (r) => r.patch ?? "Unknown" },
                {
                  id: "champion",
                  header: "Champion",
                  render: (r) => (
                    <ChampionPortrait
                      name={r.championName ?? `Champion ${r.championKey}`}
                      portraits={portraits}
                    />
                  ),
                },
                {
                  id: "result",
                  header: "Result",
                  render: (r) => <GameResult won={r.win} />,
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
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-4">
              <span className="np-meta text-accent">
                {profile.games.total} sampled games · Page {profile.games.page}
              </span>
              <Pagination
                label="Recent Game Pages"
                currentPage={profile.games.page}
                totalPages={Math.max(1, Math.ceil(profile.games.total / 25))}
                onPageChange={(p) => go("page", p)}
              />
            </div>
          </Panel>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-start gap-4 max-[1150px]:grid-cols-1">
            <Panel title="Champion Pool" padding="none">
              <Table
                caption="Sampled Champion Pool"
                rows={profile.champions.items}
                getRowKey={(r) => String(r.championKey)}
                emptyMessage="No sampled champions in this selection."
                columns={[
                  {
                    id: "champion",
                    header: "Champion",
                    render: (r) => (
                      <span className="inline-flex items-center gap-2">
                        <ChampionIcon
                          id={r.championId ?? String(r.championKey)}
                          name={r.name ?? `Champion ${r.championKey}`}
                          imageUrl={r.imageUrl}
                          size="small"
                        />
                      </span>
                    ),
                  },
                  { id: "games", header: "Games", align: "end", render: (r) => r.games },
                  {
                    id: "rate",
                    header: "Win Rate",
                    align: "end",
                    render: (r) =>
                      r.winRate.value === null
                        ? "Unknown"
                        : `${(r.winRate.value * 100).toFixed(1)}%`,
                  },
                  {
                    id: "sample",
                    header: "Known Results",
                    align: "end",
                    render: (r) => r.winRate.sampleCount,
                  },
                ]}
              />
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line px-4 py-4">
                <span className="np-meta text-accent">
                  {profile.champions.total} champions · Page {profile.champions.page}
                </span>
                <Pagination
                  label="Champion Pool Pages"
                  currentPage={profile.champions.page}
                  totalPages={Math.max(1, Math.ceil(profile.champions.total / 25))}
                  onPageChange={(p) => go("championPage", p)}
                />
              </div>
            </Panel>
            <Panel aria-label="Ladder History" title="LP and Rank History">
              {profile.history.length ? (
                profile.history.map((h) => (
                  <div key={h.platform} className="flex flex-col gap-4 [&+&]:mt-6">
                    <h3 className="font-mono">{h.platform.toUpperCase()}</h3>
                    <LineChart
                      title={`${h.platform.toUpperCase()} LP history`}
                      xLabel="Day in Window"
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
                      xLabel="Day in Window"
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
                  inset
                  title="No Ladder Snapshots in This Window"
                  description="History appears after the worker observes this player in a successful ladder refresh."
                />
              )}
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
