"use client";
import { ChampionIcon, LineChart, Table, TextLink } from "@summonersnet/ui";
import type { SoloGame } from "@summonersnet/data/contracts";

const percent = (value: number | null) =>
  value === null ? "Unknown" : `${(value * 100).toFixed(1)}%`;
const sideLabel = (side: "blue" | "red" | null) =>
  side === "blue" ? "Blue" : side === "red" ? "Red" : "Unknown";

export function SoloGamePage({ game }: { game: SoloGame }) {
  const wp = game.winProbability;
  const blue = game.teams.find((t) => t.side === "blue");
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Solo queue · {game.matchId}</span>
          <h1>
            {blue?.win === true
              ? "Blue side won"
              : blue?.win === false
                ? "Red side won"
                : "Result unknown"}
          </h1>
          <p className="np-meta">
            {game.patch ? `Patch ${game.patch}` : "Unknown patch"}
            {game.durationSeconds !== null
              ? ` · ${Math.floor(game.durationSeconds / 60)} min ${game.durationSeconds % 60} s`
              : ""}
          </p>
        </div>
      </header>
      <section className="np-stack" aria-labelledby="wp-heading">
        <h2 id="wp-heading">Win probability</h2>
        {wp.model && wp.points.length ? (
          <>
            <p className="np-meta">
              Blue side&apos;s chance to win at each minute, from win probability model v
              {wp.model.modelVersion} (#{wp.model.id}, features v{wp.model.featureVersion}). Its
              Brier score on held-out games is{" "}
              {wp.model.brier === null ? "unknown" : wp.model.brier.toFixed(3)} (lower is better;
              0.25 is a coin flip). Minutes without stored features are gaps.{" "}
              <TextLink href={`/models?model=${wp.model.id}`}>Model diagnostics</TextLink>.
            </p>
            <LineChart
              title="Blue side win probability by minute"
              xLabel="Minute"
              yLabel="Blue win probability (%)"
              color="blue"
              points={wp.points.map((p) => ({
                id: String(p.minute),
                label: `Minute ${p.minute}`,
                x: p.minute,
                y:
                  p.blueWinProbability === null
                    ? null
                    : Math.round(p.blueWinProbability * 1000) / 10,
                sampleCount: null,
              }))}
              markers={wp.markers.map((m) => ({
                id: m.id,
                x: m.timestampMs / 60000,
                label: m.label,
                ...(m.team ? { color: m.team } : {}),
              }))}
            />
          </>
        ) : (
          <p role="status">{wp.reason}</p>
        )}
        <Table
          caption="Kills and objectives"
          compact
          rows={wp.markers}
          getRowKey={(m) => m.id}
          emptyMessage="No timeline events stored for this game."
          columns={[
            {
              id: "time",
              header: "Time",
              render: (m) =>
                `${Math.floor(m.timestampMs / 60000)}:${String(Math.floor((m.timestampMs % 60000) / 1000)).padStart(2, "0")}`,
            },
            { id: "team", header: "Team", render: (m) => sideLabel(m.team) },
            { id: "event", header: "Event", render: (m) => m.label },
            {
              id: "wp",
              header: "Blue win probability that minute",
              align: "end",
              render: (m) =>
                percent(wp.points.find((p) => p.minute === m.minute)?.blueWinProbability ?? null),
            },
          ]}
        />
      </section>
      <Table
        caption="Players"
        rows={game.participants}
        getRowKey={(p) => String(p.participantId)}
        columns={[
          { id: "side", header: "Side", render: (p) => sideLabel(p.side) },
          {
            id: "champion",
            header: "Champion",
            render: (p) => {
              const name = p.championName ?? `Champion ${p.championKey}`;
              return (
                <span className="ev-champion">
                  <ChampionIcon
                    id={p.championId ?? String(p.championKey)}
                    name={name}
                    imageUrl={null}
                    size="small"
                  />
                  {p.championId ? (
                    <TextLink href={`/champions/${p.championId}`}>{name}</TextLink>
                  ) : (
                    name
                  )}
                </span>
              );
            },
          },
          { id: "role", header: "Role", render: (p) => p.role ?? "Unknown" },
          {
            id: "kda",
            header: "K / D / A",
            render: (p) =>
              [p.kills, p.deaths, p.assists].map((v) => (v === null ? "?" : v)).join(" / "),
          },
        ]}
      />
    </div>
  );
}
