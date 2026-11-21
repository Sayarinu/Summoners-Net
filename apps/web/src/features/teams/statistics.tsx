"use client";
import type { TeamStatistics } from "@summonersnet/data/contracts";
import { Panel, Stat, StatGroup } from "@summonersnet/ui";

type Sampled = TeamStatistics["winRate"];
const percent = (v: Sampled) => (v.value === null ? "Unknown" : `${(v.value * 100).toFixed(1)}%`);
const fixed = (v: Sampled, digits: number, signed = false) => {
  if (v.value === null) return "Unknown";
  const text = v.value.toFixed(digits);
  return signed && v.value > 0 ? `+${text}` : text;
};
/** Seconds as m:ss. */
const clock = (v: Sampled) => {
  if (v.value === null) return "Unknown";
  const whole = Math.round(v.value);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};
const games = (v: Sampled) => `${v.sampleCount} ${v.sampleCount === 1 ? "Game" : "Games"}`;

/** How a team plays: side records, game lengths, early leads, first objectives and control. */
export function TeamStatisticsPanel({ statistics: s }: { statistics: TeamStatistics }) {
  if (!s.games) return null;
  const group = "grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-5";
  return (
    <Panel title="Team Statistics">
      <div className="flex flex-col gap-5">
        <StatGroup label="Sides and Game Length" className={group}>
          {s.sides.map((side) => (
            <Stat
              key={side.side}
              label={
                <span className={side.side === "blue" ? "text-side-blue" : "text-side-red"}>
                  {side.side === "blue" ? "Blue" : "Red"} Side Win Rate
                </span>
              }
              value={percent(side.winRate)}
              detail={games(side.winRate)}
            />
          ))}
          <Stat
            label="Game Length in Wins"
            value={clock(s.gameLength.wins)}
            detail={games(s.gameLength.wins)}
          />
          <Stat
            label="Game Length in Losses"
            value={clock(s.gameLength.losses)}
            detail={games(s.gameLength.losses)}
          />
          <Stat
            label="Gold Diff @15"
            value={fixed(s.goldDiffAt15, 0, true)}
            detail={games(s.goldDiffAt15)}
          />
          <Stat
            label="Kills / Minute"
            value={fixed(s.killsPerMinute, 2)}
            detail={games(s.killsPerMinute)}
          />
        </StatGroup>
        <StatGroup label="First Objectives" className={`${group} border-t border-line pt-4`}>
          {(
            [
              ["First Blood", s.firstBlood],
              ["First Tower", s.firstTower],
              ["First Dragon", s.firstDragon],
              ["First Herald", s.firstHerald],
              ["First Baron", s.firstBaron],
            ] as const
          ).map(([label, value]) => (
            <Stat key={label} label={label} value={percent(value)} detail={games(value)} />
          ))}
        </StatGroup>
        <StatGroup label="Objective Control" className={`${group} border-t border-line pt-4`}>
          {(
            [
              ["Dragon Control", s.dragonControl],
              ["Void Grub Control", s.voidGrubControl],
              ["Herald Control", s.heraldControl],
              ["Baron Control", s.baronControl],
            ] as const
          ).map(([label, value]) => (
            <Stat key={label} label={label} value={percent(value)} detail={games(value)} />
          ))}
          <Stat
            label="Towers / Game"
            value={fixed(s.towersPerGame, 1)}
            detail={games(s.towersPerGame)}
          />
        </StatGroup>
      </div>
    </Panel>
  );
}
