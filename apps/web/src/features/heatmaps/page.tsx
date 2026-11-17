import { EmptyState, Minimap, TextLink } from "@summonersnet/ui";
import {
  heatmapKinds,
  heatmapRoles,
  type Heatmap,
  type HeatmapKind,
} from "@summonersnet/data/contracts";

const kindLabels: Record<HeatmapKind, string> = {
  position: "Positions",
  death: "Deaths",
  kill: "Kills",
};
const roleLabels: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
};
const subjectLabels = { champion: "Champion", player: "Player", role: "Role" } as const;

function href(h: Pick<Heatmap, "subjectKind" | "subject">, kind: HeatmapKind, patch?: string) {
  const params = new URLSearchParams({ subjectKind: h.subjectKind, subject: h.subject, kind });
  if (patch) params.set("patch", patch);
  return `/heatmaps?${params.toString()}`;
}

export function HeatmapPage({ heatmap, error }: { heatmap: Heatmap | null; error: string | null }) {
  if (!heatmap)
    return (
      <div className="np-stack">
        <h1>Heatmap</h1>
        <p role="alert">{error}</p>
      </div>
    );
  const h = heatmap;
  const name =
    h.subjectKind === "role"
      ? (roleLabels[h.subject] ?? h.subject)
      : (h.label ?? (h.subjectKind === "player" ? "Riot ID not resolved" : h.subject));
  const selected = h.patch ?? undefined;
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">
            Solo queue heatmap · {subjectLabels[h.subjectKind]}
            {h.patch ? ` · Patch ${h.patch}` : ""}
          </span>
          <h1>
            {name}: {kindLabels[h.kind].toLowerCase()}
          </h1>
        </div>
      </header>
      <nav aria-label="Heatmap Type" className="ev-filters">
        {heatmapKinds.map((k) => (
          <TextLink
            key={k}
            href={href(h, k, selected)}
            aria-current={k === h.kind ? "page" : undefined}
          >
            {kindLabels[k]}
          </TextLink>
        ))}
      </nav>
      {h.patches.length ? (
        <nav aria-label="Patch" className="ev-filters">
          {h.patches.map((p) => (
            <TextLink
              key={p.patch}
              href={href(h, h.kind, p.patch)}
              aria-current={p.patch === h.patch ? "page" : undefined}
            >
              {`${p.patch} (${p.games} ${p.games === 1 ? "game" : "games"})`}
            </TextLink>
          ))}
        </nav>
      ) : null}
      <nav aria-label="Role Heatmaps" className="ev-filters">
        {heatmapRoles.map((r) => (
          <TextLink
            key={r}
            href={href({ subjectKind: "role", subject: r }, h.kind, selected)}
            aria-current={h.subjectKind === "role" && h.subject === r ? "page" : undefined}
          >
            {roleLabels[r]}
          </TextLink>
        ))}
      </nav>
      <p className="np-meta">
        Positions are each minute frame from minute 1 (minute 0 is the fountain); deaths and kills
        are where champion kills happened. Red side is rotated half a turn about the map centre, so
        every heatmap reads from blue side: the player&apos;s own base is bottom left. Points are
        counted on a fixed 16 by 16 grid, and points outside the map are skipped.
      </p>
      {!h.patch || !h.patches.some((p) => p.patch === h.patch) ? (
        <EmptyState
          title="No Heatmap Yet"
          description="Heatmaps are built by the aggregate job from solo-queue games with stored timelines."
        />
      ) : (
        <>
          <p role="status">
            Sample: {h.games} {h.games === 1 ? "game" : "games"} and {h.points}{" "}
            {h.points === 1 ? "point" : "points"} on patch {h.patch}.
          </p>
          {h.games < h.minimumGames ? (
            <EmptyState
              title="Too Few Games to Draw"
              description={`A heatmap is drawn from ${h.minimumGames} games; this one has ${h.games}.`}
            />
          ) : (
            <Minimap
              title={`${name} ${kindLabels[h.kind].toLowerCase()} heatmap, patch ${h.patch}`}
              heat={h.cells.map((c) => ({
                id: `${c.cellX}:${c.cellY}`,
                label: `Cell ${c.cellX + 1}, ${c.cellY + 1}`,
                side: "blue",
                x: c.x,
                y: c.y,
                value: c.points,
                sampleCount: c.points,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}
