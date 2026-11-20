import type { HistoricalGameDetail } from "@summonersnet/data";
import { RoleIcon } from "@summonersnet/ui";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";

const actions = ["ban", "pick"] as const;
const phases = [1, 2] as const;
const roles = ["Top", "Jungle", "Mid", "Bottom", "Support"];

export interface FearlessPick {
  role: string;
  champion: string;
}

/** A ban's portrait is struck through. */
const banSlash =
  "after:pointer-events-none after:absolute after:inset-px after:bg-[linear-gradient(to_bottom_right,transparent_calc(50%-1px),var(--color-text-primary)_50%,transparent_calc(50%+1px))] after:opacity-70 after:content-['']";
/** Draft tiles scale with the draft's width. */
const tileList =
  "flex list-none items-end gap-1 [&_[role=img]]:h-auto [&_[role=img]]:w-[clamp(23px,6cqi,36px)] [&_[role=img]]:aspect-square";
const tile =
  "grid min-w-0 grid-rows-[minmax(1rem,auto)_auto] justify-items-center gap-px rounded-sm bg-surface p-[2px]";
/** An empty ban slot above each portrait, tinted red. */
const banTile =
  "before:size-full before:rounded-sm before:bg-[color-mix(in_srgb,var(--color-status-danger)_38%,var(--color-bg-surface))] before:content-['']";
const phaseRow = "flex flex-wrap gap-2";

function DraftPortrait({
  name,
  portraits,
  ban = false,
}: {
  name: string | null;
  portraits?: ChampionPortraits | undefined;
  ban?: boolean;
}) {
  return (
    <span className={`relative row-start-2 grid ${ban ? banSlash : ""}`}>
      <ChampionPortrait name={name} portraits={portraits} size="medium" />
    </span>
  );
}

export function DraftPanel({
  detail,
  portraits,
  fearless = null,
}: {
  detail: HistoricalGameDetail;
  portraits?: ChampionPortraits | undefined;
  fearless?: FearlessPick[] | null;
}) {
  const hasDraft = detail.draft.some((side) =>
    [...side.picks, ...side.bans].some((champion) => champion !== null),
  );
  if (!hasDraft && !fearless?.length) return null;
  const firstPicks = detail.draft.filter(({ firstPick }) => firstPick === true);
  const firstPickSide = firstPicks.length === 1 ? firstPicks[0]?.side : null;
  const ordered = detail.draftOrder.length > 0;
  const withFearless = fearless !== null;
  /** With fearless bans beside it, a narrow draft centers its rows. */
  const centered = withFearless ? "@max-[24rem]:justify-center" : "";

  return (
    <section
      className={`@container grid w-full gap-3 rounded-md border border-line bg-raised p-3 ${
        withFearless
          ? `items-center ${hasDraft ? "@min-[46.75rem]/page:grid-cols-2" : ""}`
          : "items-start @min-[46.75rem]/page:w-[calc((100%-var(--space-3))/2)]"
      }`}
      aria-label="Draft Order"
      data-fearless={withFearless || undefined}
    >
      {hasDraft ? (
        <div
          className={`grid min-w-0 gap-2 ${withFearless ? "max-w-full justify-self-center" : ""}`}
        >
          {!ordered ? <p className="np-meta">Full draft order unavailable.</p> : null}
          {detail.draft.map(({ side, bans, picks }) => {
            const label = side === "blue" ? "Blue Side" : "Red Side";
            return (
              <div
                className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-2 text-xs text-[color:var(--np-team-side)] @max-[24rem]:grid-cols-[minmax(0,1fr)] @max-[24rem]:gap-1"
                data-side={side}
                key={side}
              >
                <div
                  className={`grid @max-[24rem]:flex @max-[24rem]:items-baseline @max-[24rem]:gap-2 ${centered}`}
                >
                  <span>{label}</span>
                  {firstPickSide ? (
                    <small className="text-2xs text-accent">
                      {firstPickSide === side ? "First Pick" : "Second Pick"}
                    </small>
                  ) : null}
                </div>
                <div className={`${phaseRow} gap-x-4 ${centered}`}>
                  {ordered ? (
                    phases.map((phase) => (
                      <div className={`${phaseRow} ${centered}`} key={phase}>
                        {actions.map((action) => (
                          <ol
                            className={tileList}
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
                                <li
                                  className={`${tile} ${action === "ban" ? banTile : ""}`}
                                  key={slot}
                                >
                                  {action === "pick" ? (
                                    <span className="grid place-items-center font-mono text-xs leading-none font-medium text-fg tabular-nums">
                                      {slot}
                                    </span>
                                  ) : null}
                                  <DraftPortrait
                                    name={champion}
                                    portraits={portraits}
                                    ban={action === "ban"}
                                  />
                                </li>
                              ))}
                          </ol>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className={`${phaseRow} ${centered}`}>
                      {actions.map((action) => (
                        <ol
                          className={tileList}
                          key={action}
                          data-action={action}
                          role="list"
                          aria-label={`${label} ${action === "ban" ? "Bans" : "Picks"}`}
                        >
                          {(action === "ban" ? bans : picks).map((champion, index) => (
                            <li
                              className={`${tile} ${action === "ban" ? banTile : ""}`}
                              key={index}
                            >
                              <DraftPortrait
                                name={champion}
                                portraits={portraits}
                                ban={action === "ban"}
                              />
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
      {fearless !== null ? (
        <section
          className={`grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,6rem),1fr))] items-start gap-1 [--fearless-portrait:1.875rem] @max-[24rem]:grid-cols-[repeat(auto-fit,minmax(min(100%,5rem),1fr))] @max-[24rem]:[--fearless-portrait:1.5rem] [&_li_[role=img]]:size-(--fearless-portrait) ${fearless.length ? "" : "invisible"}`}
          aria-label="Fearless Bans"
          aria-hidden={!fearless.length || undefined}
        >
          {roles.map((role) => (
            <div className="relative justify-self-center" key={role}>
              <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2">
                <RoleIcon role={role} />
              </span>
              <ol
                className="grid min-h-[calc(4*var(--fearless-portrait)+3*var(--space-1))] list-none grid-cols-[var(--fearless-portrait)_1.5rem_var(--fearless-portrait)] auto-rows-(--fearless-portrait) content-center gap-1"
                aria-label={`${role} Fearless Bans`}
                role="list"
              >
                {fearless
                  .filter((pick) => pick.role === role.toLowerCase())
                  .map(({ champion }) => (
                    <li
                      className="grid place-items-center odd:col-start-1 even:col-start-3"
                      key={champion}
                    >
                      <ChampionPortrait name={champion} portraits={portraits} size="medium" />
                    </li>
                  ))}
              </ol>
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}
