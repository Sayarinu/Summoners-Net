"use client";
import { Panel, Stat, StatGroup, Table, TextLink } from "@summonersnet/ui";
import { identityHref } from "../browse/presentation";
import type { ChampionOverview, ProChampionPerformance } from "@summonersnet/data/contracts";
import { goToPage, PageFooter } from "./paging";
import { average, percent, sampledRate } from "./presentation";

/** Seconds as m:ss, rounded to the nearest second. */
const clock = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/** The pro headline figures beside the champion: draft presence, results and draft order. */
export function ProHeaderStats({ pro }: { pro: ChampionOverview["pro"] }) {
  const [blue, red] = pro.sides;
  return (
    <StatGroup
      label="Pro-Play Statistics"
      className="grid grid-cols-6 gap-5 max-[1150px]:grid-cols-3 max-[500px]:grid-cols-2"
    >
      <Stat
        label="Presence"
        size="lg"
        value={percent(pro.presence)}
        detail={`${pro.games.toLocaleString()} Games`}
      />
      <Stat label="Picks / Bans" size="lg" value={`${pro.picks} / ${pro.bans}`} detail="Drafts" />
      <Stat
        label="Win Rate"
        size="lg"
        value={sampledRate(pro.winRate)}
        detail={`${pro.winRate.sampleCount} Results`}
      />
      <Stat
        label="Blind Pick"
        size="lg"
        value={percent(pro.blindRate)}
        detail={`${pro.blindRate.sampleCount} Picks · ${percent(pro.counterRate)} Counter`}
      />
      {[blue, red].map((s) =>
        s ? (
          <Stat
            key={s.side}
            label={
              <span className={s.side === "blue" ? "text-side-blue" : "text-side-red"}>
                {s.side === "blue" ? "Blue" : "Red"} Side Win Rate
              </span>
            }
            size="lg"
            value={sampledRate(s.winRate)}
            detail={`${s.picks} Picks · ${s.winRate.sampleCount} Results`}
          />
        ) : null,
      )}
    </StatGroup>
  );
}

/** Per-game figures once picked, and the draft names the import could not map. */
export function ProSection({ overview }: { overview: ChampionOverview }) {
  const { pro } = overview;
  return (
    <Panel title="Performance per Game">
      {!pro.patch ? (
        <p className="np-meta">No pro drafts imported yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {pro.performance.games > 0 ? (
            <PerformanceStats label="Pro-Play Performance" performance={pro.performance} />
          ) : (
            <p className="np-meta">No player rows for this champion in the selection.</p>
          )}
          {pro.unmapped.length > 0 && (
            <p className="np-meta">
              Not counted because they have no champion mapping:{" "}
              {pro.unmapped.map((u) => u.name).join(", ")}.
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

/** Each league's draft use and results on the patch, most present first. */
export function ProLeaguesSection({ overview }: { overview: ChampionOverview }) {
  const { pro, champion, query: q } = overview;
  const href = (league: string) => {
    // The pro view's league filter is its region.
    const params = new URLSearchParams({ source: "pro", role: q.role, region: league });
    if (pro.patch) params.set("patch", pro.patch);
    return `/champions/${encodeURIComponent(champion.id)}?${params}`;
  };
  return (
    <Panel title="By League" padding="none">
      <Table
        caption={`${champion.name} by League`}
        rows={pro.byLeague}
        getRowKey={(r) => r.league}
        emptyMessage="Not picked or banned in any league on this patch."
        columns={[
          {
            id: "league",
            header: "League",
            render: (r) => (
              <TextLink
                href={href(r.league)}
                aria-current={r.league === q.region ? "page" : undefined}
              >
                {r.league}
              </TextLink>
            ),
          },
          { id: "games", header: "Games", align: "end", render: (r) => r.games },
          { id: "presence", header: "Presence", align: "end", render: (r) => percent(r.presence) },
          {
            id: "draft",
            header: "Picks / Bans",
            align: "end",
            render: (r) => `${r.picks} / ${r.bans}`,
          },
          { id: "win", header: "Win Rate", align: "end", render: (r) => sampledRate(r.winRate) },
        ]}
      />
    </Panel>
  );
}

/** The players who played the champion on the patch, most games first. */
export function ProPlayersSection({ overview }: { overview: ChampionOverview }) {
  const { proPlayers: players, champion } = overview;
  if (!players) return null;
  return (
    <Panel title="Pro Players" padding="none">
      <Table
        caption={`${champion.name} Pro Players`}
        rows={players.items}
        getRowKey={(r) => `${r.name}:${r.team ?? ""}:${r.leagues.join(",")}`}
        emptyMessage="No player picked this champion in the selection."
        columns={[
          {
            id: "player",
            header: "Player",
            render: (r) => (
              <span className="flex flex-col">
                {r.profile?.publicSlug ? (
                  <TextLink
                    href={identityHref({
                      kind: "player",
                      name: r.profile.name,
                      publicSlug: r.profile.publicSlug,
                    })}
                  >
                    {r.name}
                  </TextLink>
                ) : (
                  r.name
                )}
                <small className="text-xs text-fg-muted">{r.team ?? "Unknown Team"}</small>
              </span>
            ),
          },
          { id: "leagues", header: "League", render: (r) => r.leagues.join(", ") },
          { id: "games", header: "Games", align: "end", render: (r) => r.games },
          {
            id: "win",
            header: "Win Rate",
            align: "end",
            render: (r) => sampledRate(r.winRate),
          },
          { id: "kda", header: "KDA", align: "end", render: (r) => average(r.kda, 2) },
        ]}
      />
      {players.total > players.items.length ? (
        <p className="px-4 py-3 font-mono text-xs text-fg-muted">
          {players.items.length} of {players.total} players
        </p>
      ) : null}
    </Panel>
  );
}

/** The champion's pro play on every patch, newest first; each patch opens its own page. */
export function ProHistorySection({ overview }: { overview: ChampionOverview }) {
  const { proHistory: history, query: q, champion } = overview;
  if (!history.page.total) return null;
  const href = (patch: string) => {
    const params = new URLSearchParams({ source: "pro", role: q.role, patch });
    if (history.league) params.set("region", history.league);
    return `/champions/${encodeURIComponent(champion.id)}?${params}`;
  };
  const sided = (side: "blue" | "red", value: (typeof history.page.items)[number]["winRate"]) => (
    <span className={side === "blue" ? "text-side-blue" : "text-side-red"}>
      {sampledRate(value)}
    </span>
  );
  return (
    <Panel title="Patch History" padding="none">
      <Table
        caption={`${champion.name} Pro Play by Patch${history.league ? ` · ${history.league}` : ""}`}
        rows={history.page.items}
        getRowKey={(r) => r.patch}
        columns={[
          {
            id: "patch",
            header: "Patch",
            render: (r) => (
              <TextLink
                href={href(r.patch)}
                aria-current={r.patch === overview.pro.patch ? "page" : undefined}
              >
                {r.patch}
              </TextLink>
            ),
          },
          { id: "games", header: "Games", align: "end", render: (r) => r.games },
          { id: "presence", header: "Presence", align: "end", render: (r) => percent(r.presence) },
          { id: "picks", header: "Picks", align: "end", render: (r) => r.picks },
          { id: "bans", header: "Bans", align: "end", render: (r) => r.bans },
          {
            id: "win",
            header: "Win Rate",
            align: "end",
            render: (r) => `${sampledRate(r.winRate)} (${r.winRate.sampleCount})`,
          },
          {
            id: "blue",
            header: "Blue Side",
            align: "end",
            render: (r) => sided("blue", r.blueWinRate),
          },
          {
            id: "red",
            header: "Red Side",
            align: "end",
            render: (r) => sided("red", r.redWinRate),
          },
        ]}
      />
      <PageFooter
        summary={`${history.page.total} ${history.page.total === 1 ? "patch" : "patches"}${history.league ? ` in ${history.league}` : ""}`}
        label="Patch History Pages"
        page={history.page.page}
        total={history.page.total}
        pageSize={history.page.pageSize}
        onPageChange={(page) => goToPage("historyPage", page)}
      />
    </Panel>
  );
}

/**
 * Per-game averages once picked. Values the source never records (`sampleCount` 0 and absent from
 * every game, such as solo queue's early leads) are left out rather than shown as unknown.
 */
export function PerformanceStats({
  label,
  performance,
  className = "",
  omitUnrecorded = false,
}: {
  label: string;
  performance: ProChampionPerformance;
  className?: string;
  omitUnrecorded?: boolean;
}) {
  return (
    <StatGroup
      label={label}
      className={`grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5 ${className}`}
    >
      {(
        [
          ["KDA", performance.kda, 2, false],
          ["Kills / Game", performance.killsPerGame, 1, false],
          ["Deaths / Game", performance.deathsPerGame, 1, false],
          ["Assists / Game", performance.assistsPerGame, 1, false],
          ["CS / Minute", performance.csPerMinute, 1, false],
          ["Gold / Minute", performance.goldPerMinute, 0, false],
          ["Damage / Minute", performance.damagePerMinute, 0, false],
          ["Gold Diff @15", performance.goldDiffAt15, 0, true],
          ["CS Diff @15", performance.csDiffAt15, 1, true],
          ["XP Diff @15", performance.xpDiffAt15, 0, true],
          ["Vision / Minute", performance.visionScorePerMinute, 2, false],
        ] as const
      )
        .filter(([, value]) => !omitUnrecorded || value.sampleCount > 0)
        .map(([name, value, digits, signed]) => (
          <Stat
            key={name}
            label={name}
            value={average(value, digits, signed)}
            detail={`${value.sampleCount} Games`}
          />
        ))}
      {(
        [
          ["Kill Participation", performance.killParticipation],
          ["Damage Share", performance.damageShare],
          ["First Blood", performance.firstBloodParticipation],
        ] as const
      )
        .filter(([, value]) => !omitUnrecorded || value.sampleCount > 0)
        .map(([name, value]) => (
          <Stat
            key={name}
            label={name}
            value={percent(value)}
            detail={`${value.sampleCount} Games`}
          />
        ))}
      <Stat
        label="Game Length"
        value={
          performance.gameLength.value === null ? "Unknown" : clock(performance.gameLength.value)
        }
        detail={`${performance.gameLength.sampleCount} Games`}
      />
    </StatGroup>
  );
}
