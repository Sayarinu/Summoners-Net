"use client";
import {
  Button,
  FilterBar,
  Panel,
  Select,
  Stat,
  StatGroup,
  Table,
  TextLink,
} from "@summonersnet/ui";
import type { ChampionOverview, ProChampionPerformance } from "@summonersnet/data/contracts";
import { goToPage, PageFooter } from "./paging";
import { average, percent } from "./presentation";

/** Seconds as m:ss, rounded to the nearest second. */
const clock = (seconds: number) => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

export function ProSection({ overview }: { overview: ChampionOverview }) {
  const { pro, query: q, champion } = overview;
  return (
    <Panel
      title="Pro Play"
      actions={
        <FilterBar action={`/champions/${champion.id}`} method="get">
          {(["source", "patch", "role", "region", "tier"] as const).map((name) =>
            q[name] ? <input key={name} type="hidden" name={name} value={q[name]} /> : null,
          )}
          <Select
            label="League"
            hideLabel
            name="league"
            defaultValue={q.league ?? "all"}
            options={[
              { label: "All Leagues", value: "all" },
              ...pro.leagues.map((l) => ({ label: l, value: l })),
            ]}
          />
          <Button type="submit">Apply League</Button>
        </FilterBar>
      }
    >
      {!pro.patch ? (
        <p className="np-meta">No pro drafts imported yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <StatGroup
            label="Pro-Play Statistics"
            className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5"
          >
            <Stat label="Presence" value={percent(pro.presence)} detail={`${pro.games} Games`} />
            <Stat label="Picks / Bans" value={`${pro.picks} / ${pro.bans}`} detail="Drafts" />
            <Stat
              label="Win Rate"
              value={percent(pro.winRate)}
              detail={`${pro.winRate.sampleCount} Results`}
            />
            {pro.sides.map((s) => (
              <Stat
                key={s.side}
                label={
                  <span className={s.side === "blue" ? "text-side-blue" : "text-side-red"}>
                    {s.side === "blue" ? "Blue" : "Red"} Side Win Rate
                  </span>
                }
                value={percent(s.winRate)}
                detail={`${s.picks} Picks · ${s.winRate.sampleCount} Results`}
              />
            ))}
            <Stat
              label="Blind / Counter"
              value={`${percent(pro.blindRate)} / ${percent(pro.counterRate)}`}
              detail={`${pro.blindRate.sampleCount} Picks`}
            />
          </StatGroup>
          {pro.performance.games > 0 ? (
            <PerformanceStats
              label="Pro-Play Performance"
              performance={pro.performance}
              className="border-t border-line pt-4"
            />
          ) : null}
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

/** The champion's pro play on every patch, newest first; each patch opens its own page. */
export function ProHistorySection({ overview }: { overview: ChampionOverview }) {
  const { proHistory: history, query: q, champion } = overview;
  if (!history.page.total) return null;
  const href = (patch: string) => {
    const params = new URLSearchParams({ source: "pro", role: q.role, patch });
    if (q.league) params.set("league", q.league);
    return `/champions/${encodeURIComponent(champion.id)}?${params}`;
  };
  const sided = (side: "blue" | "red", value: (typeof history.page.items)[number]["winRate"]) => (
    <span className={side === "blue" ? "text-side-blue" : "text-side-red"}>{percent(value)}</span>
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
            render: (r) => `${percent(r.winRate)} (${r.winRate.sampleCount})`,
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
