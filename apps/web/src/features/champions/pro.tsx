"use client";
import { Button, Select } from "@summonersnet/ui";
import type { ChampionOverview } from "@summonersnet/data/contracts";
import { percent } from "./presentation";

function Tile({ label, value, sample }: { label: string; value: string; sample: string }) {
  return (
    <div className="ev-stat-tile">
      <dt>
        {label}
        <small>{sample}</small>
      </dt>
      <dd>{value}</dd>
    </div>
  );
}
export function ProSection({ overview }: { overview: ChampionOverview }) {
  const { pro, query: q, champion } = overview;
  return (
    <section className="np-stack" aria-labelledby="pro-heading">
      <h2 id="pro-heading">Pro Play</h2>
      <form
        action={`/champions/${champion.id}`}
        method="get"
        className="ev-filters ev-filters--compact"
      >
        {(["source", "patch", "role", "region", "tier"] as const).map((name) =>
          q[name] ? <input key={name} type="hidden" name={name} value={q[name]} /> : null,
        )}
        <Select
          label="League"
          name="league"
          defaultValue={q.league ?? "all"}
          options={[
            { label: "All Leagues", value: "all" },
            ...pro.leagues.map((l) => ({ label: l, value: l })),
          ]}
        />
        <Button type="submit">Apply League</Button>
      </form>
      {!pro.patch ? (
        <p className="np-meta">No pro drafts imported yet.</p>
      ) : (
        <>
          <dl className="ev-stat-grid" aria-label="Pro-Play Statistics">
            <Tile label="Presence" value={percent(pro.presence)} sample={`${pro.games} Games`} />
            <Tile label="Picks / Bans" value={`${pro.picks} / ${pro.bans}`} sample="Drafts" />
            <Tile
              label="Win Rate"
              value={percent(pro.winRate)}
              sample={`${pro.winRate.sampleCount} Results`}
            />
            {pro.sides.map((s) => (
              <Tile
                key={s.side}
                label={`${s.side === "blue" ? "Blue" : "Red"} Side Win Rate`}
                value={percent(s.winRate)}
                sample={`${s.picks} Picks · ${s.winRate.sampleCount} Results`}
              />
            ))}
            <Tile
              label="Blind / Counter"
              value={`${percent(pro.blindRate)} / ${percent(pro.counterRate)}`}
              sample={`${pro.blindRate.sampleCount} Picks`}
            />
          </dl>
          {pro.unmapped.length > 0 && (
            <p className="np-meta">
              Not counted because they have no champion mapping:{" "}
              {pro.unmapped.map((u) => u.name).join(", ")}.
            </p>
          )}
        </>
      )}
    </section>
  );
}
