"use client";
import { useId, useState, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { Avatar, DrakeIcon, ObjectiveIcon, Panel, type Objective } from "@summonersnet/ui";
import type {
  Game,
  HistoricalGameDetail,
  HistoricalParticipant,
  ProGameWinProbability,
} from "@summonersnet/data";
import { gameTeams } from "../browse/presentation";

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const goldAmount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compactGold = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const width = 600;
const height = 200;
const middle = height / 2;
const inset = 16;
const eventFields = [
  ["First Blood", "combat", "firstblood", "fbtime"],
  ["First Dragon", "objectives", "firstdragon", "fdtime"],
  ["Rift Herald", "objectives", "firstherald", "heraldtime"],
  ["First Baron", "objectives", "firstbaron", "fbarontime"],
  ["First Tower", "objectives", "firsttower", "fttime"],
] as const;

interface TimelinePoint {
  seconds: number;
  time: string;
  lead: number | null;
  label: string;
  description: string;
  /** Short hover value: the leading team and its lead, or null when unknown. */
  readout: { team: string | null; value: string } | null;
}

type TimelineEvent = NonNullable<HistoricalGameDetail["telemetry"]>["events"][number];

const eventAbbreviations: Record<string, string> = {
  "First Dragon": "DR",
  Dragon: "DR",
  "Elder Dragon": "ED",
};

const eventObjectives: Record<string, Objective> = {
  "First Blood": "first-blood",
  "First Tower": "tower",
  "Rift Herald": "herald",
  "Void Grub": "grub",
  "First Baron": "baron",
  "Baron Nashor": "baron",
};

/** The event's icon, or null when it has none and shows as text. */
function eventIcon(label: string, drake: TimelineEvent["drake"]) {
  if (drake) return <DrakeIcon drake={drake} />;
  const objective = eventObjectives[label];
  return objective ? <ObjectiveIcon objective={objective} label={label} /> : null;
}

/** Marker rows above the plot: same-side repeats within 45 seconds merge, and overlaps stack. */
function eventMarkers(events: TimelineEvent[], end: number) {
  const merged: (TimelineEvent & { count: number; times: number[] })[] = [];
  for (const event of events) {
    const previous = merged.findLast(
      (marker) =>
        marker.label === event.label &&
        marker.side === event.side &&
        marker.drake === event.drake &&
        event.seconds - marker.times.at(-1)! <= 45,
    );
    if (previous) {
      previous.count++;
      previous.times.push(event.seconds);
    } else merged.push({ ...event, count: 1, times: [event.seconds] });
  }
  const rowEnds: number[] = [];
  return merged.map((marker) => {
    const fraction = plotX(marker.seconds, end) / width;
    const span = marker.count > 1 ? 0.05 : 0.035;
    let row = rowEnds.findIndex((rowEnd) => rowEnd < fraction - span / 2);
    if (row < 0) row = rowEnds.length;
    rowEnds[row] = fraction + span / 2;
    return { ...marker, row };
  });
}

const sideText = "text-[color:var(--np-team-side,var(--color-text-muted))]";
/** An event chip, tinted by the side that took it and highlighted while its time is hovered. */
const eventChip = [
  "rounded-sm border border-line",
  "data-side:border-[color-mix(in_srgb,var(--np-team-side)_55%,transparent)] data-side:bg-[color-mix(in_srgb,var(--np-team-side)_18%,var(--color-bg-raised))]",
  "data-active:border-[color:var(--np-team-side,var(--color-border-strong))] data-active:bg-[color-mix(in_srgb,var(--np-team-side,transparent)_30%,var(--color-bg-raised))]",
  // Repeated for chips with a side, so the active tint outranks the side tint.
  "data-side:data-active:border-[color:var(--np-team-side)] data-side:data-active:bg-[color-mix(in_srgb,var(--np-team-side)_30%,var(--color-bg-raised))]",
].join(" ");
const scaling = "[vector-effect:non-scaling-stroke]";

/** One labelled row of the timeline: a vertical label beside its content. */
function TimelineRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2">
      <span className="rotate-180 self-center justify-self-center text-xs text-accent [writing-mode:vertical-rl]">
        {label}
      </span>
      {children}
    </div>
  );
}

function plotX(seconds: number, end: number) {
  return inset + (seconds / end) * (width - 2 * inset);
}

const sideInLead = (lead: number | null) => (lead ? (lead > 0 ? "blue" : "red") : undefined);

function clockLabel(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function goldCheckpoints(rows: HistoricalParticipant[], duration: number | null) {
  const blue = rows.find(({ side }) => side === "blue")?.statistics;
  const red = rows.find(({ side }) => side === "red")?.statistics;
  const points = [10, 15, 20, 25].flatMap((minute) => {
    const seconds = minute * 60;
    if (duration !== null && seconds > duration) return [];
    const blueDiff = blue?.checkpoints[`golddiffat${minute}`];
    const redDiff = red?.checkpoints[`golddiffat${minute}`];
    const blueGold = blue?.checkpoints[`goldat${minute}`];
    const redGold = red?.checkpoints[`goldat${minute}`];
    const lead =
      blueDiff ??
      (redDiff != null
        ? -redDiff
        : blueGold != null && redGold != null
          ? blueGold - redGold
          : null);
    return [{ seconds, time: `${minute}m`, lead }];
  });
  const lastBlue = blue?.economy.totalgold;
  const lastRed = red?.economy.totalgold;
  if (duration && lastBlue != null && lastRed != null) {
    const current = points.find((point) => point.seconds === duration);
    if (current) current.lead ??= lastBlue - lastRed;
    else points.push({ seconds: duration, time: clockLabel(duration), lead: lastBlue - lastRed });
  }
  return points;
}

function leadReadout(lead: number | null, blueName: string, redName: string, format: string) {
  if (lead === null) return null;
  if (lead === 0) return { team: null, value: format };
  return { team: lead > 0 ? blueName : redName, value: format };
}

export function ProTimeline({
  game,
  detail,
  winProbability,
}: {
  game: Game;
  detail?: HistoricalGameDetail | null | undefined;
  winProbability?: ProGameWinProbability | null | undefined;
}) {
  const teams = gameTeams(game);
  const blueName = teams.find(({ side }) => side === "blue")?.name ?? "Unknown Team";
  const redName = teams.find(({ side }) => side === "red")?.name ?? "Unknown Team";
  const teamRows = detail?.participants.filter(({ position }) => position === "team") ?? [];
  const timedEvents = detail?.telemetry?.events ?? [];
  const checkpointEvents = eventFields
    .filter(([label]) => {
      if (label === "First Dragon") return !timedEvents.some(({ label }) => label === "Dragon");
      if (label === "First Baron")
        return !timedEvents.some(({ label }) => label === "Baron Nashor");
      return !timedEvents.some((event) => event.label === label);
    })
    .flatMap(([label, group, first, timer]) => {
      const firsts = teamRows.filter(({ statistics }) => statistics[group][first] === 1);
      const owner = firsts.length === 1 ? firsts[0] : undefined;
      const times = new Set(
        teamRows.flatMap(({ statistics }) => {
          const minute = statistics[group][timer];
          return minute != null && minute > 0 ? [minute] : [];
        }),
      );
      const minute = owner?.statistics[group][timer] || (times.size === 1 ? [...times][0] : null);
      if (!minute || minute < 0) return [];
      const seconds = Math.round(minute * 60);
      if (detail?.context.durationSeconds && seconds > detail.context.durationSeconds) return [];
      return [{ label, seconds, side: owner?.side ?? null, drake: null }];
    });
  const events: TimelineEvent[] = [...checkpointEvents, ...timedEvents].sort(
    (a, b) => a.seconds - b.seconds,
  );
  const [hover, setHover] = useState<number | null>(null);
  const duration = detail?.context.durationSeconds ?? null;
  const probability = (winProbability?.model ? winProbability.points : []).map(
    ({ minute, blueWinProbability: value }): TimelinePoint => ({
      seconds: minute * 60,
      time: clockLabel(minute * 60),
      lead: value === null ? null : value - 0.5,
      label: value === null ? "" : percent.format(Math.max(value, 1 - value)),
      description:
        value === null
          ? `${clockLabel(minute * 60)}: win probability unavailable`
          : `${clockLabel(minute * 60)}: ${blueName} ${percent.format(value)}, ${redName} ${percent.format(1 - value)}`,
      readout:
        value === null
          ? null
          : value === 0.5
            ? { team: null, value: "Even" }
            : {
                team: value > 0.5 ? blueName : redName,
                value: percent.format(Math.max(value, 1 - value)),
              },
    }),
  );
  const trackedGold = detail?.telemetry?.gold ?? [];
  const gold = (
    trackedGold.length
      ? trackedGold.map(({ seconds, lead }) => ({
          seconds,
          time: clockLabel(seconds),
          lead,
        }))
      : goldCheckpoints(teamRows, duration)
  ).map(({ seconds, time, lead }): TimelinePoint => ({
    seconds,
    time,
    lead,
    label: lead === null ? "" : `${lead ? "+" : ""}${goldAmount.format(Math.abs(lead))}`,
    description:
      lead == null
        ? `${clockLabel(seconds)}: gold difference unavailable`
        : lead === 0
          ? `${clockLabel(seconds)}: tied on gold`
          : `${clockLabel(seconds)}: ${lead > 0 ? blueName : redName} ahead by ${goldAmount.format(Math.abs(lead))} gold`,
    readout: leadReadout(
      lead,
      blueName,
      redName,
      lead ? `+${goldAmount.format(Math.abs(lead))} Gold` : "Even",
    ),
  }));
  const hasProbability = probability.some(({ lead }) => lead !== null);
  const hasGold = gold.some(({ lead }) => lead !== null);
  if (!events.length && !hasProbability && !hasGold) return null;
  const end = Math.max(
    1,
    duration ?? 0,
    ...probability.map(({ seconds }) => seconds),
    ...gold.map(({ seconds }) => seconds),
    ...events.map(({ seconds }) => seconds),
  );
  const peakGold = Math.max(1, ...gold.map(({ lead }) => Math.abs(lead ?? 0)));
  const magnitude = 10 ** Math.floor(Math.log10(peakGold));
  const goldLimit = Math.ceil(peakGold / magnitude) * magnitude;
  return (
    <Panel aria-label="Timeline" title="Timeline">
      <div className="grid gap-3">
        {events.length ? (
          <TimelineRow label="Events">
            <ol
              className="flex list-none flex-wrap items-center gap-1"
              aria-label="Game Events"
              role="list"
            >
              {events.map(({ label, seconds, side, drake }, index) => (
                <li
                  className={`${eventChip} flex items-center gap-1 px-2 py-1 text-sm text-[color:var(--np-team-side,var(--color-text-primary))]`}
                  key={index}
                  data-side={side ?? undefined}
                  data-active={hover === seconds || undefined}
                  title={teams.find((team) => team.side === side)?.name}
                  onPointerEnter={() => setHover(seconds)}
                  onPointerLeave={() => setHover(null)}
                >
                  <time className="np-meta" dateTime={`PT${seconds}S`}>
                    {clockLabel(seconds)}
                  </time>
                  {eventIcon(label, drake) ?? <span>{label}</span>}
                </li>
              ))}
            </ol>
          </TimelineRow>
        ) : null}
        {hasGold ? (
          <TimelineRow label="Gold Difference">
            <SideTimelinePlot
              points={gold}
              teams={teams}
              end={end}
              events={events}
              markers
              hover={hover}
              onHover={setHover}
              limit={goldLimit}
              edgeLabel={compactGold.format(goldLimit)}
              centerLabel="0"
              label="Gold Difference by Time. Zero marks a tie."
            />
          </TimelineRow>
        ) : null}
        {hasProbability ? (
          <TimelineRow label="Win Probability">
            <SideTimelinePlot
              points={probability}
              teams={teams}
              end={end}
              events={events}
              markers={!hasGold}
              hover={hover}
              onHover={setHover}
              limit={0.5}
              edgeLabel="100%"
              centerLabel="0%"
              label="Win Probability by Minute. Zero marks even odds. Each team reaches 100% at its end of the scale."
            />
          </TimelineRow>
        ) : null}
      </div>
    </Panel>
  );
}

const sideStroke = "stroke-[color:var(--np-team-side,var(--color-text-muted))]";
const dot = `${sideStroke} [stroke-linecap:round] ${scaling}`;

function SideTimelinePlot({
  points,
  teams,
  end,
  events,
  markers,
  hover,
  onHover,
  limit,
  edgeLabel,
  centerLabel,
  label,
}: {
  points: TimelinePoint[];
  teams: ReturnType<typeof gameTeams>;
  end: number;
  events: TimelineEvent[];
  /** Show labelled event markers above this plot; dashed event lines always show. */
  markers: boolean;
  hover: number | null;
  onHover: (seconds: number | null) => void;
  limit: number;
  edgeLabel: string;
  centerLabel: string;
  label: string;
}) {
  const clipId = useId();
  const blueTeam = teams.find(({ side }) => side === "blue");
  const redTeam = teams.find(({ side }) => side === "red");
  const ticks = [
    { y: inset, label: edgeLabel, team: blueTeam },
    { y: middle, label: centerLabel, team: undefined },
    { y: height - inset, label: edgeLabel, team: redTeam },
  ];

  const dense = points.length > 8;
  const last = points.at(-1)?.seconds ?? 0;
  const samples = points.map((point) => ({
    showLabel:
      !dense || point.seconds === last || (point.seconds % 300 === 0 && last - point.seconds > 90),
    ...point,
    side: sideInLead(point.lead),
    x: plotX(point.seconds, end),
    y: point.lead === null ? null : middle - (point.lead / limit) * (middle - inset),
  }));
  const segments = samples.flatMap((sample, index) => {
    const previous = samples[index - 1];
    if (!previous || previous.y === null || sample.y === null) return [];
    return [{ previous, sample }];
  });
  const slope = segments
    .map(({ previous, sample }) => `M ${previous.x} ${previous.y} L ${sample.x} ${sample.y}`)
    .join(" ");
  const area = segments
    .map(
      ({ previous, sample }) =>
        `M ${previous.x} ${middle} L ${previous.x} ${previous.y} L ${sample.x} ${sample.y} L ${sample.x} ${middle} Z`,
    )
    .join(" ");

  const known = samples.filter(({ y }) => y !== null);
  // A hovered time matches this plot's nearest sample within about half its sampling interval.
  const spacing =
    known.length > 1 ? (known.at(-1)!.seconds - known[0]!.seconds) / (known.length - 1) : 60;
  const reach = Math.max(30, spacing * 0.6);
  const nearest = (seconds: number) =>
    known.reduce<(typeof known)[number] | undefined>(
      (best, sample) =>
        Math.abs(sample.seconds - seconds) <= reach &&
        (!best || Math.abs(sample.seconds - seconds) < Math.abs(best.seconds - seconds))
          ? sample
          : best,
      undefined,
    );
  const active = hover === null ? undefined : nearest(hover);
  const activeIndex = active ? known.indexOf(active) : -1;
  const since = activeIndex > 0 ? known[activeIndex - 1]!.seconds : -1;
  const activeEvents = active
    ? events.filter(({ seconds }) => seconds > since && seconds <= active.seconds)
    : [];
  const cursorX = active ? active.x : hover === null ? null : plotX(hover, end);
  const rail = markers ? eventMarkers(events, end) : [];
  const railRows = rail.reduce((rows, { row }) => Math.max(rows, row + 1), 0);
  const track = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (!box.width) return;
    const x = ((event.clientX - box.left) / box.width) * width;
    const seconds = Math.min(end, Math.max(0, ((x - inset) / (width - 2 * inset)) * end));
    onHover(nearest(seconds)?.seconds ?? Math.round(seconds));
  };
  const sideName = (side: "blue" | "red" | null) => teams.find((team) => team.side === side)?.name;

  return (
    <div
      className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 font-mono text-xs tabular-nums [--chart-height:clamp(11.5rem,20vw,16rem)] [--rail-row:1.35rem] [--rail:calc(var(--rail-rows,0)*var(--rail-row))]"
      role="group"
      aria-label={label}
      style={railRows ? ({ "--rail-rows": railRows } as CSSProperties) : undefined}
    >
      <div
        className="relative mt-(--rail) h-(--chart-height) w-16 text-fg-muted"
        aria-hidden="true"
      >
        {ticks.map(({ y, label, team }) => (
          <span
            className="absolute end-0 flex -translate-y-1/2 items-center gap-1 data-side:text-[color:var(--np-team-side)]"
            data-side={team?.side}
            key={y}
            style={{ insetBlockStart: `${(y / height) * 100}%` }}
            title={team?.name}
          >
            {team ? (
              <Avatar
                alt=""
                fallback={team.name}
                src={team.imageUrl ?? undefined}
                entityKind="team"
                size="small"
              />
            ) : null}
            <span>{label}</span>
          </span>
        ))}
      </div>
      <div
        className="relative touch-pan-y pt-(--rail) pb-[1.3rem]"
        onPointerMove={track}
        onPointerDown={track}
        onPointerLeave={() => onHover(null)}
      >
        {rail.length ? (
          <ol className="absolute inset-x-0 top-0 h-(--rail) list-none" aria-hidden="true">
            {rail.map(({ label: name, seconds, side, drake, count, times, row }) => (
              <li
                className={`${eventChip} absolute inline-flex h-[calc(var(--rail-row)-0.2rem)] -translate-x-1/2 cursor-default items-center gap-px bg-raised px-[3px] text-[0.625rem] leading-none whitespace-nowrap ${sideText} [&_[role=img]]:size-[0.85rem]`}
                key={`${seconds}-${name}`}
                data-side={side ?? undefined}
                data-active={times.includes(hover ?? -1) || undefined}
                title={`${times.map(clockLabel).join(", ")} ${name}${count > 1 ? ` ×${count}` : ""}${sideName(side) ? ` (${sideName(side)})` : ""}`}
                style={{
                  insetInlineStart: `${(plotX(seconds, end) / width) * 100}%`,
                  insetBlockStart: `calc(${row} * var(--rail-row))`,
                }}
                onPointerEnter={() => onHover(seconds)}
              >
                {eventIcon(name, drake) ?? eventAbbreviations[name] ?? name.slice(0, 2)}
                {count > 1 ? <span>×{count}</span> : null}
              </li>
            ))}
          </ol>
        ) : null}
        <svg
          className="block h-(--chart-height) w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={`${clipId}-blue`}>
              <rect width={width} height={middle} />
            </clipPath>
            <clipPath id={`${clipId}-red`}>
              <rect y={middle} width={width} height={middle} />
            </clipPath>
          </defs>
          {ticks.map(({ y }) => (
            <line
              className={`fill-none ${scaling} ${y === middle ? "stroke-line-strong" : "stroke-line"}`}
              key={y}
              x2={width}
              y1={y}
              y2={y}
            />
          ))}
          {(["blue", "red"] as const).map((side) => (
            <g key={side} data-side={side} clipPath={`url(#${clipId}-${side})`}>
              <path className="fill-[color:var(--np-team-side)] opacity-36" d={area} />
              <path
                className={`fill-none stroke-[color:var(--np-team-side)] stroke-2 [stroke-linecap:round] ${scaling}`}
                d={slope}
              />
            </g>
          ))}
          {events.map(({ seconds, side }, index) => (
            <line
              className={`${sideStroke} stroke-1 opacity-55 [stroke-dasharray:4_4] ${scaling} data-active:stroke-2 data-active:opacity-100`}
              key={`event-${index}`}
              data-side={side ?? undefined}
              data-active={hover === seconds || undefined}
              x1={plotX(seconds, end)}
              x2={plotX(seconds, end)}
              y1={0}
              y2={height}
            />
          ))}
          {cursorX === null ? null : (
            <line
              className={`stroke-fg-muted stroke-1 ${scaling}`}
              x1={cursorX}
              x2={cursorX}
              y1={0}
              y2={height}
            />
          )}
          {active ? (
            <line
              className={`${dot} stroke-10`}
              data-active
              data-side={active.side}
              x1={active.x}
              x2={active.x}
              y1={active.y!}
              y2={active.y!}
            />
          ) : null}
          {samples.map(({ seconds, side, x, y, showLabel }) =>
            y === null || !showLabel ? null : (
              <line
                className={`${dot} stroke-7`}
                key={seconds}
                x1={x}
                x2={x}
                y1={y}
                y2={y}
                data-side={side}
              />
            ),
          )}
        </svg>
        <ol className="absolute inset-x-0 top-(--rail) bottom-[1.3rem] list-none" role="list">
          {samples.map(
            ({ seconds, time, side, label: valueLabel, description, x, y, showLabel }) => (
              <li
                className="absolute inset-y-0"
                key={seconds}
                data-side={side}
                title={description}
                style={{ insetInlineStart: `${(x / width) * 100}%` }}
              >
                <span className="np-visually-hidden">{description}</span>
                {y === null || !showLabel ? null : (
                  <span
                    className={`absolute start-0 -translate-x-1/2 whitespace-nowrap ${sideText} ${side === "red" ? "translate-y-[3px]" : "-translate-y-[calc(100%+3px)]"}`}
                    aria-hidden="true"
                    style={{ insetBlockStart: `${(y / height) * 100}%` }}
                  >
                    {valueLabel}
                  </span>
                )}
                {showLabel ? (
                  <span
                    className="absolute start-0 top-full -translate-x-1/2 whitespace-nowrap text-fg-muted"
                    aria-hidden="true"
                  >
                    {time}
                  </span>
                ) : null}
              </li>
            ),
          )}
        </ol>
        {active?.readout ? (
          <div
            className={`pointer-events-none absolute top-[calc(var(--rail)+0.25rem)] z-1 grid min-w-28 gap-[2px] rounded-sm border border-line-strong bg-raised px-2 py-1 text-fg ${active.x / width > 0.7 ? "-translate-x-[calc(100%+0.5rem)]" : "translate-x-2"}`}
            aria-hidden="true"
            data-side={active.side}
            data-flip={active.x / width > 0.7 || undefined}
            style={{ insetInlineStart: `${(active.x / width) * 100}%` }}
          >
            <span className="np-meta">{clockLabel(active.seconds)}</span>
            <strong className="text-[color:var(--np-team-side,var(--color-text-primary))]">
              {active.readout.value}
            </strong>
            {active.readout.team ? <span>{active.readout.team}</span> : null}
            {activeEvents.map(({ label: name, seconds, side }, index) => (
              <span className={sideText} data-side={side ?? undefined} key={index}>
                {clockLabel(seconds)} {name}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
