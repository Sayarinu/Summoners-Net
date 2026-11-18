import type { HistoricalGameDetail } from "@summonersnet/data";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";

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
  const firstPicks = detail.draft.filter(({ firstPick }) => firstPick === true);
  const firstPickSide = firstPicks.length === 1 ? firstPicks[0]?.side : null;

  return (
    <section className="ev-draft" aria-labelledby="draft-order-heading">
      <h2 id="draft-order-heading">Draft Order</h2>
      {detail.draftOrder.length ? (
        <div className="ev-draft-order">
          {phases.map(({ number, slots }) => (
            <div className="ev-draft-phase" key={number}>
              <div className="ev-draft-phase__row ev-draft-phase__head">
                <h3>Bans {slots}</h3>
                <h3>Picks {slots}</h3>
              </div>
              {detail.draft.map(({ side }) => {
                const label = side === "blue" ? "Blue Side" : "Red Side";
                return (
                  <div className="ev-draft-phase__row" data-side={side} key={side}>
                    <div className="ev-draft-side">
                      <span>{label}</span>
                      {number === 1 && firstPickSide === side ? <small>First Pick</small> : null}
                    </div>
                    {(["ban", "pick"] as const).map((action) => (
                      <ol
                        key={action}
                        role="list"
                        aria-label={`${label} ${action === "ban" ? "Bans" : "Picks"} ${slots}`}
                      >
                        {detail.draftOrder
                          .filter(
                            (event) =>
                              event.phase === number &&
                              event.action === action &&
                              event.side === side,
                          )
                          .map((event) => (
                            <li key={event.slot}>
                              <span className="ev-draft-slot">{event.slot}</span>
                              <ChampionPortrait
                                name={event.champion}
                                portraits={portraits}
                                size="medium"
                              />
                            </li>
                          ))}
                      </ol>
                    ))}
                  </div>
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
                <h3 className="ev-draft-side">
                  {side === "blue" ? "Blue Side" : "Red Side"}
                  {firstPickSide === side ? <small>First Pick</small> : null}
                </h3>
                {(
                  [
                    ["Bans", bans],
                    ["Picks", picks],
                  ] as const
                ).map(([label, champions]) => (
                  <div key={label} className="np-stack" aria-label={label} role="group">
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
    </section>
  );
}
