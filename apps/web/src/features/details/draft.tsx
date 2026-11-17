import type { HistoricalGameDetail } from "@summonersnet/data";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { Disclosure } from "./disclosure";

const phases = [
  { phase: 1, action: "ban", label: "Bans 1–6" },
  { phase: 1, action: "pick", label: "Picks 1–6" },
  { phase: 2, action: "ban", label: "Bans 7–10" },
  { phase: 2, action: "pick", label: "Picks 7–10" },
] as const;

export function DraftPanel({
  detail,
  portraits,
}: {
  detail: HistoricalGameDetail;
  portraits?: ChampionPortraits | undefined;
}) {
  const hasDraft = detail.draft.some((side) =>
    [...side.picks, ...side.bans].some((champion) => champion !== null),
  );
  if (!hasDraft) return null;

  return (
    <Disclosure title="Draft Order">
      {detail.draftOrder.length ? (
        <div className="ev-draft-order">
          {phases.map(({ phase, action, label }) => (
            <section className="ev-draft-phase" key={label} aria-label={label}>
              <h3>{label}</h3>
              <ol>
                {detail.draftOrder
                  .filter((event) => event.phase === phase && event.action === action)
                  .map((event) => (
                    <li key={event.slot} data-side={event.side}>
                      <span className="ev-draft-slot">
                        <span className="np-visually-hidden">
                          {event.side} {event.action}{" "}
                        </span>
                        {event.slot}
                      </span>
                      <ChampionPortrait name={event.champion} portraits={portraits} />
                    </li>
                  ))}
              </ol>
            </section>
          ))}
        </div>
      ) : (
        <div className="np-stack">
          <p className="np-meta">Full draft order unavailable.</p>
          <div className="ev-draft-order">
            {detail.draft.map(({ side, picks, bans }) => (
              <section className="ev-draft-phase" key={side} data-side={side}>
                <h3>{side === "blue" ? "Blue Side" : "Red Side"}</h3>
                {(
                  [
                    ["Picks", picks],
                    ["Bans", bans],
                  ] as const
                ).map(([label, champions]) => (
                  <div key={label} className="np-cluster" aria-label={label} role="group">
                    <span className="np-meta">{label}</span>
                    {champions.map((champion, index) => (
                      <ChampionPortrait key={index} name={champion} portraits={portraits} />
                    ))}
                  </div>
                ))}
              </section>
            ))}
          </div>
        </div>
      )}
    </Disclosure>
  );
}
