"use client";
import { useId } from "react";
import { Avatar } from "@summonersnet/ui";
import type { Game, HistoricalGameDetail, ProGameWinProbability } from "@summonersnet/data";
import { gameTeams } from "../browse/presentation";

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
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
  const teamRows = detail?.participants.filter(({ position }) => position === "team") ?? [];
  const events = eventFields
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
      return [{ label, seconds, side: owner?.side }];
    })
    .sort((a, b) => a.seconds - b.seconds);
  const points = winProbability?.model ? winProbability.points : [];
  const hasProbability = points.some(({ blueWinProbability }) => blueWinProbability !== null);
  if (!events.length && !hasProbability) return null;
  return (
    <section className="ev-disclosure ev-timeline" aria-label="Timeline">
      <h2 className="ev-timeline__heading">Timeline</h2>
      <div className="ev-disclosure__body">
        {events.length ? (
          <div className="ev-timeline-row">
            <span className="ev-timeline-row__label">Events</span>
            <ol className="ev-timeline-events" aria-label="Game Events" role="list">
              {events.map(({ label, seconds, side }) => (
                <li
                  key={label}
                  data-side={side}
                  title={teams.find((team) => team.side === side)?.name}
                >
                  <time className="np-meta" dateTime={`PT${seconds}S`}>
                    {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
                  </time>
                  <span>{label}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
        {hasProbability ? (
          <div className="ev-timeline-row">
            <span className="ev-timeline-row__label ev-timeline-row__label--probability">
              Win Probability
            </span>
            <WinProbabilityPlot points={points} teams={teams} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function WinProbabilityPlot({
  points,
  teams,
}: {
  points: ProGameWinProbability["points"];
  teams: ReturnType<typeof gameTeams>;
}) {
  const clipId = useId();
  const blueTeam = teams.find(({ side }) => side === "blue");
  const redTeam = teams.find(({ side }) => side === "red");
  const ticks = [
    { y: inset, label: "100%", team: blueTeam },
    { y: middle, label: "0%", team: undefined },
    { y: height - inset, label: "100%", team: redTeam },
  ];

  const start = points[0]!.minute;
  const span = points[points.length - 1]!.minute - start;
  const samples = points.map(({ minute, blueWinProbability: blue }) => ({
    minute,
    blue,
    x: span ? inset + ((minute - start) / span) * (width - 2 * inset) : width / 2,
    y: blue === null ? null : inset + (1 - blue) * (height - 2 * inset),
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

  return (
    <div
      className="ev-probability__chart"
      role="group"
      aria-label="Win Probability by Minute. Zero marks even odds. Each team reaches 100% at its end of the scale."
    >
      <div className="ev-probability__scale" aria-hidden="true">
        {ticks.map(({ y, label, team }) => (
          <span
            className="ev-probability__tick"
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
      <div className="ev-probability__plot">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
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
              className={y === middle ? "ev-probability__baseline" : "ev-probability__gridline"}
              key={y}
              x2={width}
              y1={y}
              y2={y}
            />
          ))}
          {(["blue", "red"] as const).map((side) => (
            <g key={side} data-side={side} clipPath={`url(#${clipId}-${side})`}>
              <path className="ev-probability__area" d={area} />
              <path className="ev-probability__line" d={slope} />
            </g>
          ))}
          {samples.map(({ minute, blue, x, y }) =>
            y === null ? null : (
              <line
                className="ev-probability__dot"
                key={minute}
                x1={x}
                x2={x}
                y1={y}
                y2={y}
                data-side={blue === 0.5 ? undefined : blue! > 0.5 ? "blue" : "red"}
              />
            ),
          )}
        </svg>
        <ol className="ev-probability__points" role="list">
          {samples.map(({ minute, blue, x, y }) => {
            const side = blue === null || blue === 0.5 ? undefined : blue > 0.5 ? "blue" : "red";
            const description =
              blue === null
                ? `${minute} minutes: win probability unavailable`
                : `${minute} minutes: ${blueTeam?.name ?? "Unknown Team"} ${percent.format(blue)}, ${redTeam?.name ?? "Unknown Team"} ${percent.format(1 - blue)}`;
            return (
              <li
                key={minute}
                data-side={side}
                title={description}
                style={{ insetInlineStart: `${(x / width) * 100}%` }}
              >
                <span className="np-visually-hidden">{description}</span>
                {y === null ? null : (
                  <span
                    className="ev-probability__point"
                    aria-hidden="true"
                    style={{ insetBlockStart: `${(y / height) * 100}%` }}
                  >
                    {percent.format(Math.max(blue!, 1 - blue!))}
                  </span>
                )}
                <span className="ev-probability__minute" aria-hidden="true">
                  {minute}m
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
