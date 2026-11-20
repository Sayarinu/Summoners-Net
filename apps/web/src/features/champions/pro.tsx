"use client";
import { Button, FilterBar, Panel, Select, Stat, StatGroup } from "@summonersnet/ui";
import type { ChampionOverview } from "@summonersnet/data/contracts";
import { percent } from "./presentation";

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
