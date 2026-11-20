import {
  EmptyState,
  Minimap,
  PageHeader,
  Panel,
  RoleIcon,
  Stat,
  StatGroup,
  TabNav,
} from "@summonersnet/ui";
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
const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

function href(h: Pick<Heatmap, "subjectKind" | "subject">, kind: HeatmapKind, patch?: string) {
  const params = new URLSearchParams({ subjectKind: h.subjectKind, subject: h.subject, kind });
  if (patch) params.set("patch", patch);
  return `/heatmaps?${params.toString()}`;
}

export function HeatmapPage({ heatmap, error }: { heatmap: Heatmap | null; error: string | null }) {
  if (!heatmap)
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <PageHeader eyebrow="Solo Queue" title="Heatmap" />
        <p role="alert">{error}</p>
      </div>
    );
  const h = heatmap;
  const name =
    h.subjectKind === "role"
      ? (roleLabels[h.subject] ?? h.subject)
      : (h.label ?? (h.subjectKind === "player" ? "Riot ID not resolved" : h.subject));
  const selected = h.patch ?? undefined;
  const kind = kindLabels[h.kind].toLowerCase();
  const drawable = h.patch && h.patches.some((p) => p.patch === h.patch);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        eyebrow={`Solo Queue · ${subjectLabels[h.subjectKind]}${h.patch ? ` · Patch ${h.patch}` : ""}`}
        title={
          h.subjectKind === "role" ? (
            // The icon shows the role; screen readers hear the heading as "Jungle: kills".
            <>
              <span className="np-visually-hidden">
                {name}: {kind}
              </span>
              <span aria-hidden="true">
                <RoleIcon role={h.subject} />: {kind}
              </span>
            </>
          ) : (
            `${name}: ${kind}`
          )
        }
      />
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-3">
        <TabNav
          label="Heatmap Type"
          variant="segmented"
          items={heatmapKinds.map((k) => ({
            href: href(h, k, selected),
            label: kindLabels[k],
            current: k === h.kind,
          }))}
        />
        <TabNav
          label="Role Heatmaps"
          variant="segmented"
          items={heatmapRoles.map((r) => ({
            href: href({ subjectKind: "role", subject: r }, h.kind, selected),
            label: <RoleIcon role={r} />,
            current: h.subjectKind === "role" && h.subject === r,
          }))}
        />
        {h.patches.length ? (
          <TabNav
            label="Patch"
            variant="segmented"
            items={h.patches.map((p) => ({
              href: href(h, h.kind, p.patch),
              label: `${p.patch} (${plural(p.games, "game")})`,
              current: p.patch === h.patch,
            }))}
          />
        ) : null}
      </div>
      {!drawable ? (
        <EmptyState title="No Heatmap Yet" />
      ) : (
        <div className="grid grid-cols-[minmax(0,560px)_minmax(240px,1fr)] items-start gap-4 max-[900px]:grid-cols-1">
          <Panel title="Map">
            {h.games < h.minimumGames ? (
              <EmptyState
                inset
                title="Too Few Games to Draw"
                description={`A heatmap is drawn from ${h.minimumGames} games; this one has ${h.games}.`}
              />
            ) : (
              <Minimap
                title={`${name} ${kind} heatmap, patch ${h.patch}`}
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
          </Panel>
          <Panel title="Sample">
            <div role="status" aria-label="Sample">
              <StatGroup>
                <Stat label="Games" value={h.games} detail={`Patch ${h.patch}`} />
                <Stat label="Points" value={h.points} />
                <Stat label="Minimum to Draw" value={plural(h.minimumGames, "game")} size="sm" />
              </StatGroup>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
