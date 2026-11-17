"use client";
import { useEffect, useId, useState } from "react";
import { Button, Minimap, Select, Switch, Table, TextLink } from "@summonersnet/ui";
import type { SoloGame, SoloGamePositions } from "@summonersnet/data/contracts";
import { clock, positionAt, timelineEnd } from "./interpolate";

/** Game milliseconds advanced per real second. */
const speeds = [
  { value: "30000", label: "30× (half a minute per second)" },
  { value: "60000", label: "60× (one minute per second)" },
  { value: "120000", label: "120× (two minutes per second)" },
  { value: "240000", label: "240× (four minutes per second)" },
];
const tickMs = 100;
const roleLabels: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
};
const roleOrder = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY", "unknown"];
const roleKey = (role: string | null) => (role && role in roleLabels ? role : "unknown");
const roleLabel = (key: string) => roleLabels[key] ?? "Unknown role";

export function GameMapPage({ game, positions }: { game: SoloGame; positions: SoloGamePositions }) {
  const scrubberId = useId();
  const end = timelineEnd(positions.tracks);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(speeds[1]!.value);
  const [hiddenSides, setHiddenSides] = useState<ReadonlySet<string>>(new Set());
  const [hiddenRoles, setHiddenRoles] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () => setTime((t) => Math.min(end, t + (Number(speed) * tickMs) / 1000)),
      tickMs,
    );
    return () => clearInterval(timer);
  }, [playing, speed, end]);
  useEffect(() => {
    if (playing && time >= end) setPlaying(false);
  }, [playing, time, end]);

  const toggle =
    (set: (update: (s: ReadonlySet<string>) => ReadonlySet<string>) => void, key: string) =>
    (shown: boolean) =>
      set((current) => {
        const next = new Set(current);
        if (shown) next.delete(key);
        else next.add(key);
        return next;
      });
  const framesOf = new Map(positions.tracks.map((t) => [t.participantId, t.frames]));
  const champions = game.participants.map((p) => {
    const name = p.championName ?? `Champion ${p.championKey}`;
    return {
      ...p,
      name,
      roleKey: roleKey(p.role),
      position: positionAt(framesOf.get(p.participantId) ?? [], time),
    };
  });
  const visible = champions.filter((c) => !hiddenSides.has(c.side) && !hiddenRoles.has(c.roleKey));
  const roles = roleOrder.filter((r) => champions.some((c) => c.roleKey === r));
  const gameHref = `/solo-games/${encodeURIComponent(game.matchId)}`;
  const hasFrames = end > 0;

  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Solo queue · {game.matchId}</span>
          <h1>Game map</h1>
          <p className="np-meta">
            {game.patch ? `Patch ${game.patch}` : "Unknown patch"} ·{" "}
            <TextLink href={gameHref}>Back to the game</TextLink>
          </p>
        </div>
      </header>
      <p className="np-meta">
        Riot match timelines store one position per champion per minute. Between those samples the
        map draws a straight-line estimate, so a champion did not necessarily take that path. When a
        minute frame is missing on either side of the current time, that champion is left off the
        map rather than placed at a guessed position.
        {positions.truncated ? " Only the first 120 minutes of this timeline are shown." : ""}
      </p>
      {!hasFrames ? (
        <p role="status">
          {positions.timelineState === "fetched"
            ? "This game's timeline has no position frames."
            : "This game's timeline has not been stored, so there are no positions to show."}
        </p>
      ) : (
        <>
          <div className="ev-map-controls" role="group" aria-label="Playback">
            <Button
              variant="primary"
              onPress={() => {
                if (!playing && time >= end) setTime(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Pause" : "Play"}
            </Button>
            <Select
              label="Playback speed"
              options={speeds}
              value={speed}
              onValueChange={setSpeed}
            />
            <div className="ev-map-scrubber">
              <label htmlFor={scrubberId}>
                Game time {clock(time)} of {clock(end)}
              </label>
              <input
                id={scrubberId}
                type="range"
                min={0}
                max={end}
                step={1000}
                value={time}
                aria-valuetext={clock(time)}
                onChange={(e) => {
                  setPlaying(false);
                  setTime(Number(e.currentTarget.value));
                }}
              />
            </div>
          </div>
          <div className="ev-map-controls" role="group" aria-label="Show champions">
            <Switch selected={!hiddenSides.has("blue")} onChange={toggle(setHiddenSides, "blue")}>
              Blue team
            </Switch>
            <Switch selected={!hiddenSides.has("red")} onChange={toggle(setHiddenSides, "red")}>
              Red team
            </Switch>
            {roles.map((r) => (
              <Switch key={r} selected={!hiddenRoles.has(r)} onChange={toggle(setHiddenRoles, r)}>
                {roleLabel(r)}
              </Switch>
            ))}
          </div>
          <Minimap
            title={`Champion positions at ${clock(time)}`}
            points={visible.flatMap((c) =>
              c.position
                ? [
                    {
                      id: String(c.participantId),
                      label: c.name,
                      side: c.side,
                      x: c.position.x,
                      y: c.position.y,
                    },
                  ]
                : [],
            )}
          />
          <Table
            caption={`Positions at ${clock(time)}`}
            compact
            rows={visible}
            getRowKey={(c) => String(c.participantId)}
            emptyMessage="Every champion is hidden by the team and role toggles."
            columns={[
              { id: "champion", header: "Champion", render: (c) => c.name },
              { id: "team", header: "Team", render: (c) => (c.side === "blue" ? "Blue" : "Red") },
              { id: "role", header: "Role", render: (c) => roleLabel(c.roleKey) },
              {
                id: "position",
                header: "Position (x, y)",
                render: (c) =>
                  c.position
                    ? `${c.position.x}, ${c.position.y} (${c.position.basis === "frame" ? "minute frame" : "estimated between frames"})`
                    : "Gap: no frame",
              },
            ]}
          />
        </>
      )}
    </div>
  );
}
