import type { HistoricalGameDetail } from "@summonersnet/data";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { Disclosure } from "./disclosure";

const phases = [
  { number: 1, slots: "1–6" },
  { number: 2, slots: "7–10" },
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
    <Disclosure title="Draft Order" initiallyOpen>
      {detail.draftOrder.length ? (
        <div className="ev-draft-order">
          {phases.map(({ number, slots }) => (
            <div className="ev-draft-phase" key={number}>
              {(["ban", "pick"] as const).map((action) => {
                const label = `${action === "ban" ? "Bans" : "Picks"} ${slots}`;
                return (
                  <section className="ev-draft-phase__row" key={action} aria-label={label}>
                    <h3>{label}</h3>
                    <ol role="list">
                      {detail.draftOrder
                        .filter((event) => event.phase === number && event.action === action)
                        .map((event) => (
                          <li key={event.slot} data-side={event.side}>
                            <span className="ev-draft-slot">
                              <span className="np-visually-hidden">
                                {event.side} {event.action}{" "}
                              </span>
                              {event.slot}
                            </span>
                            <ChampionPortrait
                              name={event.champion}
                              portraits={portraits}
                              size="medium"
                            />
                          </li>
                        ))}
                    </ol>
                  </section>
                );
              })}
            </div>
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
                  <div key={label} className="ev-draft-phase__row" aria-label={label} role="group">
                    <span className="np-meta">{label}</span>
                    <div className="np-cluster">
                      {champions.map((champion, index) => (
                        <ChampionPortrait key={index} name={champion} portraits={portraits} />
                      ))}
                    </div>
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
