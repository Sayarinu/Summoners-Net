"use client";
import type { CSSProperties } from "react";
import { TextLink } from "@summonersnet/ui";
import type { ProGameWinProbability } from "@summonersnet/data";
import { Disclosure } from "./disclosure";

const percent = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });

export function ProWinProbability({ winProbability }: { winProbability: ProGameWinProbability }) {
  const { model, points } = winProbability;
  if (!model || !points.some((point) => point.blueWinProbability !== null)) return null;
  return (
    <Disclosure title="Win Probability" className="ev-probability-panel">
      <div className="np-stack ev-probability">
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
          <ol className="ev-probability__points" role="list">
            {points.map(({ minute, blueWinProbability: blue }) => {
              const side = blue === null || blue === 0.5 ? undefined : blue > 0.5 ? "blue" : "red";
              const description =
                blue === null
                  ? `${minute} minutes: win probability unavailable`
                  : `${minute} minutes: Blue Side ${percent.format(blue)}, Red Side ${percent.format(1 - blue)}`;
              return (
                <li key={minute} data-side={side} title={description}>
                  <span className="np-visually-hidden">{description}</span>
                  <div
                    className="ev-probability__track"
                    aria-hidden="true"
                    style={{ "--ev-probability-fraction": 1 - (blue ?? 0.5) } as CSSProperties}
                  >
                    {blue !== null ? <span className="ev-probability__bar" /> : null}
                    <span className="ev-probability__value">
                      {blue === null ? "—" : percent.format(Math.max(blue, 1 - blue))}
                    </span>
                  </div>
                  <span className="ev-probability__minute" aria-hidden="true">
                    {minute}m
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <TextLink href={`/models?model=${model.id}`}>Model Diagnostics</TextLink>
      </div>
    </Disclosure>
  );
}
