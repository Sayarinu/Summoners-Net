import { EmptyState, Minimap, Panel, Table } from "@summonersnet/ui";
import type {
  ChampionJunglePaths,
  GankLane,
  JunglePathCluster,
  JungleRoute,
  JungleSide,
} from "@summonersnet/data/contracts";

const startLabels: Record<JungleSide, string> = {
  "blue-buff": "Blue buff side",
  "red-buff": "Red buff side",
  invade: "Enemy jungle (invade)",
};
const routeLabels: Record<JungleRoute, string> = {
  "same-side": "Stays on the start side",
  cross: "Crosses to the other side",
  invade: "Into the enemy jungle",
};
const laneLabels: Record<GankLane, string> = { top: "Top", mid: "Mid", bot: "Bot" };
const describe = (c: JunglePathCluster) =>
  `${c.startSide ? startLabels[c.startSide] : "Unknown start"}, ${
    c.route ? routeLabels[c.route].toLowerCase() : "unknown clear"
  }, ${c.gankLane ? `${laneLabels[c.gankLane].toLowerCase()} gank` : "unknown gank"}`;

/** Inferred early jungle paths for the champion, clustered on the overview's patch. */
export function JunglePathsSection({
  paths,
  champion,
}: {
  paths: ChampionJunglePaths;
  champion: string;
}) {
  const drawn = paths.clusters.slice(0, 3);
  return (
    <Panel title="Early Jungle Paths">
      <div className="flex flex-col gap-4">
        <p className="np-meta max-w-reading">
          Inferred from {paths.games} jungle {paths.games === 1 ? "game" : "games"} on patch{" "}
          {paths.patch}: the side of the camp waited at at 1:00, the side reached by 3:00, and the
          lane of the first kill the jungler took part in before 10:00. Red side is rotated onto
          blue side. Parts that cannot be inferred are unknown. Win rates need {paths.minimumSample}{" "}
          games with a result.
        </p>
        {paths.clusters.length ? (
          <div className="grid grid-cols-[minmax(0,360px)_minmax(0,1fr)] items-start gap-4 max-[900px]:grid-cols-1">
            <Minimap
              title={`${champion}'s most played jungle paths, minutes 1 to 3`}
              paths={drawn.map((c, i) => ({
                id: String(i),
                label: `${i + 1}. ${describe(c)}`,
                side: i === 0 ? "blue" : "red",
                positions: c.path.map((p) => p ?? { x: null, y: null }),
              }))}
            />
            <Table
              caption="Jungle Paths"
              compact
              rows={paths.clusters}
              getRowKey={(c) => `${c.startSide}:${c.route}:${c.gankLane}`}
              columns={[
                {
                  id: "start",
                  header: "Start",
                  render: (c) => (c.startSide ? startLabels[c.startSide] : "Unknown"),
                },
                {
                  id: "route",
                  header: "First Clear",
                  render: (c) => (c.route ? routeLabels[c.route] : "Unknown"),
                },
                {
                  id: "gank",
                  header: "First Gank",
                  render: (c) => (c.gankLane ? laneLabels[c.gankLane] : "Unknown"),
                },
                { id: "games", header: "Games", align: "end", render: (c) => c.games },
                {
                  id: "win",
                  header: "Win Rate",
                  align: "end",
                  render: (c) =>
                    c.winRate === null
                      ? `Too few games (${c.resultGames})`
                      : `${(c.winRate * 100).toFixed(1)}% (${c.resultGames})`,
                },
              ]}
            />
          </div>
        ) : (
          <EmptyState
            title="No Jungle Games"
            description="No games with a stored timeline have this champion in the jungle on this patch."
          />
        )}
      </div>
    </Panel>
  );
}
