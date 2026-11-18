"use client";
import { useId } from "react";
import type { ProGameWinProbability } from "@summonersnet/data";
import { Disclosure } from "./disclosure";

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const width = 600;
const middle = 60;

export function ProWinProbability({ winProbability }: { winProbability: ProGameWinProbability }) {
  const clipId = useId();
  const { model, points } = winProbability;
  if (!model || !points.some((point) => point.blueWinProbability !== null)) return null;

  const start = points[0]!.minute;
  const span = points[points.length - 1]!.minute - start;
  const samples = points.map(({ minute, blueWinProbability: blue }) => ({
    minute,
    blue,
    x: span ? 16 + ((minute - start) / span) * (width - 32) : width / 2,
    y: blue === null ? null : 18 + (1 - blue) * (middle * 2 - 36),
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
    <Disclosure title="Win Probability" className="ev-probability-panel">
      <div
        className="ev-probability__chart"
        role="group"
        aria-label="Win Probability by Minute. Zero is a 50/50 chance. Blue is above zero and red is below."
      >
        <div className="ev-probability__scale" aria-hidden="true">
          <span data-side="blue">Blue +50</span>
          <span>0</span>
          <span data-side="red">Red −50</span>
        </div>
        <div className="ev-probability__plot">
          <svg viewBox={`0 0 ${width} ${middle * 2}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <clipPath id={`${clipId}-blue`}>
                <rect width={width} height={middle} />
              </clipPath>
              <clipPath id={`${clipId}-red`}>
                <rect y={middle} width={width} height={middle} />
              </clipPath>
            </defs>
            <line className="ev-probability__baseline" x2={width} y1={middle} y2={middle} />
            {(["blue", "red"] as const).map((side) => (
              <g key={side} data-side={side} clipPath={`url(#${clipId}-${side})`}>
                <path className="ev-probability__area" d={area} />
                <path className="ev-probability__line" d={slope} />
              </g>
            ))}
            {samples.map(({ minute, blue, x, y }) =>
              y === null ? null : (
                <circle
                  key={minute}
                  cx={x}
                  cy={y}
                  r={3.5}
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
                  : `${minute} minutes: Blue Side ${percent.format(blue)}, Red Side ${percent.format(1 - blue)}`;
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
                      style={{ insetBlockStart: `${(y / (middle * 2)) * 100}%` }}
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
    </Disclosure>
  );
}
