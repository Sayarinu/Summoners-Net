type Side = "blue" | "red";
export interface DraftParticipant {
  side: Side;
  position: string;
  champion: string | null;
  result: boolean | null;
  draft: Record<string, string | null>;
}
export interface DraftEvent {
  champion: string;
  action: "pick" | "ban";
  phase: number;
  slot: number;
  side: Side;
  role: string | null;
  blind: boolean | null;
}
export interface DerivedDraft {
  excludedReason: string | null;
  firstPickSide: Side | null;
  firstPickWon: boolean | null;
  events: DraftEvent[];
}
const roles = ["top", "jungle", "mid", "bottom", "support"];
const clean = (value: string | null | undefined) => {
  const text = value?.trim();
  return text && text.length <= 100 && !/^(?:na|nan|null|none)$/i.test(text) ? text : null;
};
function field(rows: DraftParticipant[], key: string) {
  const values = new Set(rows.map((r) => clean(r.draft[key])).filter((v) => v !== null));
  return values.size === 1 ? [...values][0]! : null;
}
const flag = (value: string | null) =>
  value === null
    ? null
    : /^(1(?:\.0+)?|true)$/i.test(value)
      ? true
      : /^(0(?:\.0+)?|false)$/i.test(value)
        ? false
        : null;
const excluded = (reason: string): DerivedDraft => ({
  excludedReason: reason,
  firstPickSide: null,
  firstPickWon: null,
  events: [],
});

/** Tournament snake order; map side is deliberately independent of first-pick order.
 * https://esports-assets.s3.amazonaws.com/production/files/rules/2018_LCS_LACS_Rules.pdf §11.7
 * https://lolesports.com/en-US/lolesports/news/season-start-2026-lol-esports
 */
export function deriveDraft(eligible: boolean, participants: DraftParticipant[]): DerivedDraft {
  if (!eligible) return excluded("Incomplete or inconsistent lineup");
  const sides = (["blue", "red"] as const).map((side) => ({
    side,
    rows: participants.filter((p) => p.side === side),
  }));
  const first = sides.map((s) => flag(field(s.rows, "firstpick")));
  if (first[0] === null || first[1] === null || first[0] === first[1])
    return excluded("Missing or conflicting first-pick flags");
  const firstPickSide = first[0] ? "blue" : "red";
  const events: DraftEvent[] = [];
  for (const { side, rows } of sides) {
    const players = rows.filter((r) => r.position !== "team");
    if (
      players.length !== 5 ||
      !roles.every((role) => players.filter((p) => p.position === role).length === 1)
    )
      return excluded("Incomplete or inconsistent lineup");
    for (const action of ["pick", "ban"] as const) {
      const order =
        action === "pick"
          ? side === firstPickSide
            ? [1, 4, 5, 8, 9]
            : [2, 3, 6, 7, 10]
          : side === firstPickSide
            ? [1, 3, 5, 8, 10]
            : [2, 4, 6, 7, 9];
      for (let i = 0; i < 5; i++) {
        const champion = field(rows, `${action}${i + 1}`);
        if (!champion) return excluded("Missing or conflicting pick/ban columns");
        const player = players.find((p) => clean(p.champion) === champion);
        if (action === "pick" && !player) return excluded("Picks do not match the played lineup");
        events.push({
          champion,
          action,
          phase: i < 3 ? 1 : 2,
          slot: order[i]!,
          side,
          role: action === "pick" ? player!.position : null,
          blind: null,
        });
      }
    }
  }
  if (new Set(events.map((e) => e.champion)).size !== 20)
    return excluded("Duplicate or overlapping picks and bans");
  for (const event of events.filter((e) => e.action === "pick")) {
    const opponent = events.find(
      (e) => e.action === "pick" && e.side !== event.side && e.role === event.role,
    )!;
    event.blind = event.slot < opponent.slot;
  }
  const results = new Set(
    participants.filter((p) => p.side === firstPickSide && p.result !== null).map((p) => p.result),
  );
  return {
    excludedReason: null,
    firstPickSide,
    firstPickWon: results.size === 1 ? [...results][0]! : null,
    events,
  };
}
