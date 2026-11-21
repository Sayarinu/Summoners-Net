"use client";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { LineChart, PageHeader, Panel, RoleIcon, SideName, TabNav, Table } from "@summonersnet/ui";
import type { DraftWinProbability, SoloGame } from "@summonersnet/data/contracts";
import { DraftWinProbabilitySection } from "../drafts/draft-win-probability";

const percent = (value: number | null) =>
  value === null ? "Unknown" : `${(value * 100).toFixed(1)}%`;
const sideLabel = (side: "blue" | "red" | null) =>
  side === "blue" ? "Blue" : side === "red" ? "Red" : "Unknown";

const clockOf = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

/** Switches between a solo queue game's summary and its map. */
export function SoloGameTabs({ matchId, current }: { matchId: string; current: "game" | "map" }) {
  const href = `/solo-games/${encodeURIComponent(matchId)}`;
  return (
    <TabNav
      label="Game Views"
      items={[
        { href, label: "Game", current: current === "game" },
        { href: `${href}/map`, label: "Game Map", current: current === "map" },
      ]}
    />
  );
}

/** Short mono facts for a solo queue game's page header. */
export function soloGameEyebrow(game: SoloGame) {
  return [
    "Solo Queue",
    game.matchId,
    game.patch ? `Patch ${game.patch}` : "Unknown patch",
    ...(game.durationSeconds !== null
      ? [`${Math.floor(game.durationSeconds / 60)} min ${game.durationSeconds % 60} s`]
      : []),
  ].join(" · ");
}

export function SoloGamePage({
  game,
  draft = null,
  portraits,
}: {
  game: SoloGame;
  portraits?: ChampionPortraits;
  draft?: DraftWinProbability | null;
}) {
  const wp = game.winProbability;
  const blue = game.teams.find((t) => t.side === "blue");
  return (
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader
        eyebrow={soloGameEyebrow(game)}
        title={
          blue?.win === true
            ? "Blue Side Won"
            : blue?.win === false
              ? "Red Side Won"
              : "Result unknown"
        }
      >
        <SoloGameTabs matchId={game.matchId} current="game" />
      </PageHeader>
      {draft ? (
        <DraftWinProbabilitySection
          value={draft}
          name={(key) => {
            const p = game.participants.find((x) => x.championKey === key);
            return p?.championName ?? `Champion ${key}`;
          }}
        />
      ) : null}
      <Panel title="Win Probability">
        {wp.model && wp.points.length ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-fg-secondary">
              Blue side&apos;s chance to win at each minute, from win probability model v
              {wp.model.modelVersion} (#{wp.model.id}, features v{wp.model.featureVersion}). Its
              Brier score on held-out games is{" "}
              {wp.model.brier === null ? "unknown" : wp.model.brier.toFixed(3)} (lower is better;
              0.25 is a coin flip). Minutes without stored features are gaps.
            </p>
            <LineChart
              title="Blue Side Win Probability by Minute"
              xLabel="Minute"
              yLabel="Blue Win Probability (%)"
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
          </div>
        ) : (
          <p role="status">{wp.reason}</p>
        )}
      </Panel>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] items-start gap-4 max-[1150px]:grid-cols-1">
        <Panel title="Players" padding="none">
          <Table
            caption="Players"
            rows={game.participants}
            getRowKey={(p) => String(p.participantId)}
            columns={[
              {
                id: "side",
                header: "Side",
                render: (p) => <SideName side={p.side}>{sideLabel(p.side)}</SideName>,
              },
              {
                id: "champion",
                header: "Champion",
                render: (p) => (
                  <ChampionPortrait
                    name={p.championName ?? `Champion ${p.championKey}`}
                    portraits={portraits}
                    championId={p.championId}
                  />
                ),
              },
              { id: "role", header: "Role", render: (p) => <RoleIcon role={p.role} /> },
              {
                id: "kda",
                header: "K / D / A",
                align: "end",
                render: (p) => (
                  <span className="font-mono">
                    {[p.kills, p.deaths, p.assists].map((v) => (v === null ? "?" : v)).join(" / ")}
                  </span>
                ),
              },
            ]}
          />
        </Panel>
        <Panel title="Kills and Objectives" padding="none">
          <Table
            caption="Kills and Objectives"
            compact
            rows={wp.markers}
            getRowKey={(m) => m.id}
            emptyMessage="No timeline events stored for this game."
            columns={[
              {
                id: "time",
                header: "Time",
                render: (m) => <span className="font-mono">{clockOf(m.timestampMs)}</span>,
              },
              {
                id: "team",
                header: "Team",
                render: (m) => <SideName side={m.team}>{sideLabel(m.team)}</SideName>,
              },
              { id: "event", header: "Event", render: (m) => m.label },
              {
                id: "wp",
                header: "Blue Win Probability That Minute",
                align: "end",
                render: (m) =>
                  percent(wp.points.find((p) => p.minute === m.minute)?.blueWinProbability ?? null),
              },
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
