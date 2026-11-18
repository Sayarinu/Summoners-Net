import type { HistoricalGameDetail } from "@summonersnet/data";
import { RoleIcon } from "@summonersnet/ui";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";

const actions = ["ban", "pick"] as const;
const phases = [1, 2] as const;

export interface FearlessPick {
  role: string;
  champion: string;
}

function DraftPortrait({
  name,
  portraits,
}: {
  name: string | null;
  portraits?: ChampionPortraits | undefined;
}) {
  return (
    <span className="ev-draft-portrait">
      <ChampionPortrait name={name} portraits={portraits} size="medium" />
    </span>
  );
}

function FearlessBans({
  picks,
  portraits,
}: {
  picks: FearlessPick[];
  portraits?: ChampionPortraits | undefined;
}) {
  return (
    <section className="ev-fearless" aria-label="Fearless Bans">
      {["Top", "Jungle", "Mid", "Bottom", "Support"].map((role) => (
        <div className="ev-fearless__role" key={role}>
          <RoleIcon role={role} />
          <ul
            className="ev-draft-tiles"
            data-action="ban"
            aria-label={`${role} Fearless Bans`}
            role="list"
          >
            {picks
              .filter((pick) => pick.role === role.toLowerCase())
              .map(({ champion }) => (
                <li key={champion}>
                  <DraftPortrait name={champion} portraits={portraits} />
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
  fearless = [],
}: {
  detail: HistoricalGameDetail;
  portraits?: ChampionPortraits | undefined;
  fearless?: FearlessPick[];
}) {
  const hasDraft = detail.draft.some((side) =>
    [...side.picks, ...side.bans].some((champion) => champion !== null),
  );
  if (!hasDraft && !fearless.length) return null;
  const firstPicks = detail.draft.filter(({ firstPick }) => firstPick === true);
  const firstPickSide = firstPicks.length === 1 ? firstPicks[0]?.side : null;
  const ordered = detail.draftOrder.length > 0;

  return (
    <section className="ev-draft" aria-label="Draft Order">
      {hasDraft ? (
        <div className="ev-draft__order">
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
                            className="ev-draft-tiles"
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
                                  <DraftPortrait name={champion} portraits={portraits} />
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
                          className="ev-draft-tiles"
                          key={action}
                          data-action={action}
                          role="list"
                          aria-label={`${label} ${action === "ban" ? "Bans" : "Picks"}`}
                        >
                          {(action === "ban" ? bans : picks).map((champion, index) => (
                            <li key={index}>
                              <DraftPortrait name={champion} portraits={portraits} />
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
        </div>
      ) : null}
      {fearless.length ? <FearlessBans picks={fearless} portraits={portraits} /> : null}
    </section>
  );
}
