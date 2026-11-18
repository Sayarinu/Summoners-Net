import type { HistoricalGameDetail } from "@summonersnet/data";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";

const actions = ["ban", "pick"] as const;
const phases = [1, 2] as const;

export interface FearlessGame {
  number: number;
  champions: string[];
}

export function FearlessBans({
  games,
  portraits,
}: {
  games: FearlessGame[];
  portraits?: ChampionPortraits | undefined;
}) {
  return (
    <section className="ev-fearless" aria-label="Fearless Bans">
      <h2>Fearless Bans</h2>
      {games.map(({ number, champions }) => (
        <div className="ev-fearless__game" key={number}>
          <span className="np-meta">Game {number}</span>
          <ul aria-label={`Game ${number} Fearless Bans`} role="list">
            {champions.map((champion) => (
              <li key={champion}>
                <ChampionPortrait name={champion} portraits={portraits} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

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
  const ordered = detail.draftOrder.length > 0;

  return (
    <section className="ev-draft" aria-label="Draft Order">
      {!ordered ? <p className="np-meta">Full draft order unavailable.</p> : null}
      {detail.draft.map(({ side, bans, picks }) => {
        const label = side === "blue" ? "Blue Side" : "Red Side";
        return (
          <div className="ev-draft-side" data-side={side} key={side}>
            <div className="ev-draft-side__label">
              <span>{label}</span>
              {firstPickSide ? (
                <small>{firstPickSide === side ? "First Pick" : "Second Pick"}</small>
              ) : null}
            </div>
            <div className="ev-draft-side__phases">
              {ordered ? (
                phases.map((phase) => (
                  <div className="ev-draft-phase" key={phase}>
                    {actions.map((action) => (
                      <ol
                        key={action}
                        data-action={action}
                        role="list"
                        aria-label={`${label} ${phase === 1 ? "First" : "Second"} Phase ${action === "ban" ? "Bans" : "Picks"}`}
                      >
                        {detail.draftOrder
                          .filter(
                            (event) =>
                              event.phase === phase &&
                              event.action === action &&
                              event.side === side,
                          )
                          .map(({ slot, champion }) => (
                            <li key={slot}>
                              {action === "pick" ? (
                                <span className="ev-draft-slot">{slot}</span>
                              ) : null}
                              <span className="ev-draft-portrait">
                                <ChampionPortrait
                                  name={champion}
                                  portraits={portraits}
                                  size="medium"
                                />
                              </span>
                            </li>
                          ))}
                      </ol>
                    ))}
                  </div>
                ))
              ) : (
                <div className="ev-draft-phase">
                  {actions.map((action) => (
                    <ol
                      key={action}
                      data-action={action}
                      role="list"
                      aria-label={`${label} ${action === "ban" ? "Bans" : "Picks"}`}
                    >
                      {(action === "ban" ? bans : picks).map((champion, index) => (
                        <li key={index}>
                          <span className="ev-draft-portrait">
                            <ChampionPortrait name={champion} portraits={portraits} />
                          </span>
                        </li>
                      ))}
                    </ol>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
