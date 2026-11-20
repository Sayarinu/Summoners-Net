"use client";
import { ChampionPortrait, type ChampionPortraits } from "../browse/visuals";
import { useEffect, useId, useState } from "react";
import {
  Button,
  Minimap,
  PageHeader,
  Panel,
  RoleIcon,
  Select,
  SideName,
  Switch,
  Table,
} from "@summonersnet/ui";
import type {
  MapEvent,
  MatchTrackSummary,
  SoloGame,
  SoloGameMapEvents,
  SoloGamePositions,
  TrackMovement,
} from "@summonersnet/data/contracts";
import { clock, positionAt, timelineEnd } from "./interpolate";
import { staleAfterMs, trackPositionAt, trailAt, useTrackSamples } from "./track";
import { SoloGameTabs, soloGameEyebrow } from "../solo-games/page";

/** Game milliseconds advanced per real second. */
const speeds = [
  { value: "30000", label: "30× (Half a Minute per Second)" },
  { value: "60000", label: "60× (One Minute per Second)" },
  { value: "120000", label: "120× (Two Minutes per Second)" },
  { value: "240000", label: "240× (Four Minutes per Second)" },
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
/** Events this close to the scrubber time are drawn on the map. */
const eventWindowMs = 30000;
const eventKinds: { kind: MapEvent["kind"]; label: string }[] = [
  { kind: "kill", label: "Kills" },
  { kind: "objective", label: "Objectives" },
  { kind: "ward", label: "Wards" },
];
const sideLabel = (side: "blue" | "red" | null) =>
  side === "blue" ? "Blue" : side === "red" ? "Red" : "Unknown";
const zoneLabels: Record<string, string> = {
  top: "top",
  mid: "mid",
  bot: "bot",
  jungle: "the jungle",
  "blue-base": "blue base",
  "red-base": "red base",
};
const unlinked = {
  unavailable: "A replay track is stored, but this game's Riot match does not corroborate it yet",
  mismatch:
    "A replay track is stored, but its platform, patch, map or roster does not match this game",
};
interface Position {
  x: number;
  y: number;
  label: string;
  low: boolean;
}

export function GameMapPage({
  game,
  positions,
  events,
  track = null,
  portraits,
  fetcher,
}: {
  game: SoloGame;
  portraits?: ChampionPortraits;
  positions: SoloGamePositions;
  events: SoloGameMapEvents;
  track?: MatchTrackSummary | null;
  fetcher?: typeof fetch;
}) {
  const scrubberId = useId();
  const useTrack = track?.linkState === "linked";
  const end = Math.max(timelineEnd(positions.tracks), useTrack ? track.lastMs : 0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(speeds[1]!.value);
  const [hiddenSides, setHiddenSides] = useState<ReadonlySet<string>>(new Set());
  const [hiddenRoles, setHiddenRoles] = useState<ReadonlySet<string>>(new Set());
  const [hiddenKinds, setHiddenKinds] = useState<ReadonlySet<string>>(new Set());
  // A track may cover part of the game: inside its sampled interval it is the source.
  const inTrack = useTrack && time >= track.firstMs && time <= track.lastMs;
  const loaded = useTrackSamples(game.matchId, inTrack, time, fetcher);
  const staleMs = useTrack ? staleAfterMs(track.sampleRateHz) : 0;

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
  const locate = (participantId: number): Position | null => {
    if (inTrack) {
      const p = trackPositionAt(loaded.samples, participantId, time, staleMs);
      if (!p) return null;
      const score = p.confidence === null ? "no score" : `confidence ${p.confidence.toFixed(2)}`;
      return { ...p, label: `track sample, ${p.low ? "low " : ""}${score}` };
    }
    const p = positionAt(framesOf.get(participantId) ?? [], time);
    return p
      ? {
          x: p.x,
          y: p.y,
          low: false,
          label: p.basis === "frame" ? "minute frame" : "estimated between frames",
        }
      : null;
  };
  const champions = game.participants.map((p) => {
    const name = p.championName ?? `Champion ${p.championKey}`;
    return { ...p, name, roleKey: roleKey(p.role), position: locate(p.participantId) };
  });
  const visible = champions.filter((c) => !hiddenSides.has(c.side) && !hiddenRoles.has(c.roleKey));
  const roles = roleOrder.filter((r) => champions.some((c) => c.roleKey === r));
  const nameOf = new Map(
    game.participants.map((p) => [p.participantId, p.championName ?? `Champion ${p.championKey}`]),
  );
  const describe = (e: MapEvent) => {
    const actor = e.participantId === null ? null : (nameOf.get(e.participantId) ?? null);
    if (e.kind === "kill") {
      const victim = e.victimId === null ? "a champion" : (nameOf.get(e.victimId) ?? "a champion");
      return actor ? `${actor} killed ${victim}` : `${victim} executed`;
    }
    return actor ? `${e.label} by ${actor}` : e.label;
  };
  const listed = events.events.filter((e) => !hiddenKinds.has(e.kind));
  const near = (e: MapEvent) => Math.abs(e.timestampMs - time) <= eventWindowMs;
  const drawn = (e: MapEvent) => e.x !== null && e.y !== null;
  const movementLabel = (m: TrackMovement) => {
    const names = m.participantIds.map((id) => nameOf.get(id) ?? `Participant ${id}`).join(", ");
    if (m.kind === "recall") return `Recall: ${names}`;
    if (m.kind === "roam")
      return `Roam: ${names}, ${zoneLabels[m.from ?? ""] ?? "unknown"} to ${zoneLabels[m.to]}`;
    return `Rotation: ${names} to ${zoneLabels[m.to]}`;
  };
  const hasFrames = end > 0;

  return (
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader eyebrow={soloGameEyebrow(game)} title="Game Map">
        <SoloGameTabs matchId={game.matchId} current="map" />
      </PageHeader>
      {inTrack ? (
        <p className="text-sm text-fg-secondary" role="note">
          Source at {clock(time)}: imported replay track, about {track.sampleRateHz} samples per
          second ({track.sampleCount.toLocaleString("en")} samples from {clock(track.firstMs)} to{" "}
          {clock(track.lastMs)}, imported {track.importedAt.slice(0, 10)}). Each champion is shown
          at its latest sample, never interpolated; a missing sample is a gap. Trails show the last
          10 seconds, and detections scored below 0.5 are drawn hollow.
          {loaded.failed ? " Some track samples could not be loaded." : ""}
        </p>
      ) : (
        <p className="text-sm text-fg-secondary" role="note">
          Source at {clock(time)}: Riot match timeline, one position per champion per minute.
          Between those samples the map draws a straight-line estimate, so a champion did not
          necessarily take that path. When a minute frame is missing on either side of the current
          time, that champion is left off the map rather than placed at a guessed position.
          {positions.truncated ? " Only the first 120 minutes of this timeline are shown." : ""}
          {useTrack
            ? ` An imported replay track covers ${clock(track.firstMs)} to ${clock(track.lastMs)}.`
            : track && track.linkState !== "linked"
              ? ` ${unlinked[track.linkState]}.`
              : ""}
        </p>
      )}
      {!hasFrames ? (
        <p role="status" className="rounded-md border border-line bg-raised p-4">
          {positions.timelineState === "fetched"
            ? "This game's timeline has no position frames."
            : "This game's timeline has not been stored, so there are no positions to show."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-[minmax(0,560px)_minmax(0,1fr)] items-start gap-4 max-[1150px]:grid-cols-1">
            <Panel title="Map">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Playback">
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
                    label="Playback Speed"
                    options={speeds}
                    value={speed}
                    onValueChange={setSpeed}
                  />
                  <div className="grid min-w-50 flex-1 gap-2">
                    <label htmlFor={scrubberId} className="font-mono text-sm text-fg-secondary">
                      Game time {clock(time)} of {clock(end)}
                    </label>
                    <input
                      className="w-full [accent-color:var(--color-border-accent)]"
                      id={scrubberId}
                      type="range"
                      min={0}
                      max={end}
                      step={inTrack ? Math.max(100, Math.round(1000 / track.sampleRateHz)) : 1000}
                      value={time}
                      aria-valuetext={clock(time)}
                      onChange={(e) => {
                        setPlaying(false);
                        setTime(Number(e.currentTarget.value));
                      }}
                    />
                  </div>
                </div>
                <Minimap
                  title={`Champion positions and events at ${clock(time)}`}
                  paths={
                    inTrack
                      ? visible.map((c) => ({
                          id: String(c.participantId),
                          label: `${c.name} trail`,
                          side: c.side,
                          positions: trailAt(loaded.samples, c.participantId, time),
                        }))
                      : []
                  }
                  points={[
                    ...listed
                      .filter((e) => near(e) && drawn(e))
                      .map((e) => ({
                        id: e.id,
                        label: `${clock(e.timestampMs)} ${describe(e)}`,
                        side: e.side ?? ("neutral" as const),
                        marker: e.kind,
                        x: e.x,
                        y: e.y,
                      })),
                    ...visible.flatMap((c) =>
                      c.position
                        ? [
                            {
                              id: String(c.participantId),
                              label: c.name,
                              side: c.side,
                              x: c.position.x,
                              y: c.position.y,
                              lowConfidence: c.position.low,
                            },
                          ]
                        : [],
                    ),
                  ]}
                />
                <p className="text-sm text-fg-secondary">
                  Events within 30 seconds of the current time are drawn: kills as crosses,
                  objectives as squares and wards as diamonds, in the credited team&apos;s color.
                  Events without coordinates, including every ward placement because Riot records
                  none, are listed below but not drawn.
                  {events.truncated ? " Only the first 1,000 events of this game are shown." : ""}
                </p>
              </div>
            </Panel>
            <div className="flex min-w-0 flex-col gap-4">
              <Panel title="Show on the Map">
                <div className="flex flex-col gap-3">
                  <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-2"
                    role="group"
                    aria-label="Show Champions"
                  >
                    <Switch
                      selected={!hiddenSides.has("blue")}
                      onChange={toggle(setHiddenSides, "blue")}
                    >
                      Blue Team
                    </Switch>
                    <Switch
                      selected={!hiddenSides.has("red")}
                      onChange={toggle(setHiddenSides, "red")}
                    >
                      Red Team
                    </Switch>
                    {roles.map((r) => (
                      <Switch
                        key={r}
                        selected={!hiddenRoles.has(r)}
                        onChange={toggle(setHiddenRoles, r)}
                      >
                        <RoleIcon role={r} />
                      </Switch>
                    ))}
                  </div>
                  <div
                    className="flex flex-wrap items-center gap-x-4 gap-y-2"
                    role="group"
                    aria-label="Show Events"
                  >
                    {eventKinds.map(({ kind, label }) => (
                      <Switch
                        key={kind}
                        selected={!hiddenKinds.has(kind)}
                        onChange={toggle(setHiddenKinds, kind)}
                      >
                        {label}
                      </Switch>
                    ))}
                  </div>
                </div>
              </Panel>
              <Panel title={`Positions at ${clock(time)}`} padding="none">
                <Table
                  caption={`Positions at ${clock(time)}`}
                  compact
                  rows={visible}
                  getRowKey={(c) => String(c.participantId)}
                  emptyMessage="Every champion is hidden by the team and role toggles."
                  columns={[
                    {
                      id: "champion",
                      header: "Champion",
                      render: (c) => (
                        <ChampionPortrait
                          name={c.name}
                          portraits={portraits}
                          championId={c.championId}
                        />
                      ),
                    },
                    {
                      id: "team",
                      header: "Team",
                      render: (c) => <SideName side={c.side}>{sideLabel(c.side)}</SideName>,
                    },
                    { id: "role", header: "Role", render: (c) => <RoleIcon role={c.roleKey} /> },
                    {
                      id: "position",
                      header: "Position (X, Y)",
                      render: (c) =>
                        c.position
                          ? `${c.position.x}, ${c.position.y} (${c.position.label})`
                          : inTrack
                            ? loaded.loaded
                              ? "Gap: no sample"
                              : "Loading track samples"
                            : "Gap: no frame",
                    },
                  ]}
                />
              </Panel>
            </div>
          </div>
          {useTrack ? (
            track.movements ? (
              <Panel title="Detected Movements" padding="none">
                <Table
                  caption="Detected Movements"
                  compact
                  rows={track.movements}
                  getRowKey={(m) => `${m.kind}:${m.startMs}:${m.participantIds.join(",")}`}
                  emptyMessage="No rotations, roams or recalls were detected in this track."
                  columns={[
                    {
                      id: "time",
                      header: "Time",
                      render: (m) => (
                        <Button
                          size="small"
                          variant="ghost"
                          onPress={() => {
                            setPlaying(false);
                            setTime(Math.min(end, m.startMs));
                          }}
                        >
                          {`Go to ${clock(m.startMs)}`}
                        </Button>
                      ),
                    },
                    {
                      id: "team",
                      header: "Team",
                      render: (m) => {
                        const side = m.teamId === 100 ? "blue" : "red";
                        return <SideName side={side}>{sideLabel(side)}</SideName>;
                      },
                    },
                    { id: "movement", header: "Movement", render: movementLabel },
                    {
                      id: "until",
                      header: "Confirmed At",
                      align: "end",
                      render: (m) => clock(m.endMs),
                    },
                  ]}
                />
              </Panel>
            ) : (
              <p className="text-sm text-fg-secondary">
                Movements are detected when a track is imported; this track was imported before
                detection existed. Import it again to list rotations, roams and recalls.
              </p>
            )
          ) : null}
          <Panel title="Events" padding="none">
            <Table
              caption="Events"
              compact
              rows={listed}
              getRowKey={(e) => e.id}
              emptyMessage={
                events.events.length
                  ? "Every event is hidden by the event toggles."
                  : "No kills, objectives or ward placements are stored for this game."
              }
              columns={[
                {
                  id: "time",
                  header: "Time",
                  render: (e) => (
                    <Button
                      size="small"
                      variant="ghost"
                      onPress={() => {
                        setPlaying(false);
                        setTime(Math.min(end, e.timestampMs));
                      }}
                    >
                      {`Go to ${clock(e.timestampMs)}`}
                    </Button>
                  ),
                },
                {
                  id: "team",
                  header: "Team",
                  render: (e) => <SideName side={e.side}>{sideLabel(e.side)}</SideName>,
                },
                { id: "event", header: "Event", render: describe },
                {
                  id: "map",
                  header: "On the Map",
                  render: (e) =>
                    !drawn(e)
                      ? "Not drawn: no coordinates"
                      : `${e.x}, ${e.y}${near(e) ? " (drawn now)" : ""}`,
                },
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
