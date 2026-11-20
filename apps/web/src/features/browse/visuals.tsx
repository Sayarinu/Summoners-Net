import { ChampionIcon } from "@summonersnet/ui";
import type { ComponentProps } from "react";

export type ChampionPortraits = Record<string, { id: string; imageUrl: string | null }>;

export function ChampionPortrait({
  name,
  portraits,
  championId,
  size = "small",
}: {
  name: string | null;
  championId?: string | null;
  portraits?: ChampionPortraits | undefined;
  size?: ComponentProps<typeof ChampionIcon>["size"];
}) {
  if (!name) return "—";
  const entry = Object.hasOwn(portraits ?? {}, name) ? portraits?.[name] : undefined;
  const id = entry?.id ?? championId;
  return (
    <ChampionIcon
      id={id ?? name}
      name={name}
      imageUrl={entry?.imageUrl ?? null}
      size={size}
      href={id ? `/champions/${encodeURIComponent(id)}` : undefined}
    />
  );
}

export function GameRecord({ wins, known, total }: { wins: number; known: number; total: number }) {
  return (
    <>
      {known ? (
        <span aria-label={`Wins ${wins}, losses ${known - wins}`} role="img">
          <span aria-hidden="true" className="text-success">
            {wins}
          </span>
          {" – "}
          <span aria-hidden="true" className="text-loss">
            {known - wins}
          </span>
        </span>
      ) : (
        "—"
      )}
      {total > known && (
        <small className="block font-sans text-xs">
          {total - known} unknown {total - known === 1 ? "result" : "results"}
        </small>
      )}
    </>
  );
}

export function GameResult({ won }: { won: boolean | null }) {
  if (won === null) return "Unknown";
  const label = won ? "Win" : "Loss";
  return (
    <span
      aria-label={label}
      className={won ? "text-success" : "text-loss"}
      role="img"
      title={label}
    >
      <span aria-hidden="true">●</span>
    </span>
  );
}
