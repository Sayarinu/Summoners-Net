"use client";
import { Button, Select } from "@summonersnet/ui";
import type { ChampionOverview, SampledValue } from "@summonersnet/data/contracts";
import { percent } from "./presentation";

const sampled = (rate: SampledValue, unit: string) =>
  `${percent(rate)} · ${rate.sampleCount} ${unit}`;
export function ProSection({ overview }: { overview: ChampionOverview }) {
  const { pro, query: q, champion } = overview;
  return (
    <section className="np-stack" aria-labelledby="pro-heading">
      <h2 id="pro-heading">Pro play</h2>
      <form action={`/champions/${champion.id}`} method="get" className="ev-filters">
        {(["source", "patch", "role", "region", "tier"] as const).map((name) =>
          q[name] ? <input key={name} type="hidden" name={name} value={q[name]} /> : null,
        )}
        <Select
          label="League"
          name="league"
          defaultValue={q.league ?? "all"}
          options={[
            { label: "All leagues", value: "all" },
            ...pro.leagues.map((l) => ({ label: l, value: l })),
          ]}
        />
        <Button type="submit">Apply league</Button>
      </form>
      {!pro.patch ? (
        <p className="np-meta">No pro drafts imported yet.</p>
      ) : (
        <>
          <dl className="ev-summary" aria-label="Pro-play statistics">
            <div>
              <dt>Presence · {pro.games} games</dt>
              <dd>{percent(pro.presence)}</dd>
            </div>
            <div>
              <dt>Picks / bans</dt>
              <dd>
                {pro.picks} / {pro.bans}
              </dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd>{sampled(pro.winRate, "results")}</dd>
            </div>
            {pro.sides.map((s) => (
              <div key={s.side}>
                <dt>
                  {s.side === "blue" ? "Blue" : "Red"} side · {s.picks} picks
                </dt>
                <dd>{sampled(s.winRate, "results")}</dd>
              </div>
            ))}
            <div>
              <dt>Blind / counter</dt>
              <dd>
                {percent(pro.blindRate)} / {percent(pro.counterRate)} · {pro.blindRate.sampleCount}{" "}
                picks
              </dd>
            </div>
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
