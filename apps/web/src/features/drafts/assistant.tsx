"use client";
import { RoleIcon, Button, ChampionIcon, Input, Select, Table, TextLink } from "@summonersnet/ui";
import { DraftWinProbabilitySection } from "./draft-win-probability";
import {
  matchupMinimumSample,
  matchupRoles,
  type DraftAssistant,
  type DraftCandidate,
  type DraftPart,
  type PatchChampion,
} from "@summonersnet/data/contracts";

const roles = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "Bot",
  UTILITY: "Support",
} as const;
const name = (c: PatchChampion) => c.name ?? c.championId ?? `Champion ${c.championKey}`;
const points = (value: number | null) =>
  value === null ? "Unknown" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)} pts`;
/** A part with its sample; a part that does not apply to this draft is shown as such. */
const part = (p: DraftPart | null, unit: string) =>
  p === null ? "Not used" : `${points(p.value)} · n=${p.sampleCount} ${unit}`;

export function DraftAssistantPage({
  assistant: a,
  input,
  error,
}: {
  assistant: DraftAssistant | null;
  input: { blue: string; red: string; bans: string };
  error: string | null;
}) {
  const q = a?.query;
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <h1>Draft Assistant</h1>
        </div>
      </header>
      <TextLink href="/drafts">Pro Draft Analytics</TextLink>
      <form className="ev-filters" method="get" action="/drafts/assistant">
        <Select
          label="Source"
          name="source"
          defaultValue={q?.source ?? "solo"}
          options={[
            { value: "solo", label: "Solo Queue" },
            { value: "pro", label: "Pro" },
          ]}
        />
        <Select
          label="Patch"
          name="patch"
          defaultValue={a?.patch ?? "all"}
          options={[
            { value: "all", label: "Latest Available" },
            ...(a?.patches ?? []).map((p) => ({ value: p, label: p })),
          ]}
        />
        <Select
          label="Your Side"
          name="side"
          defaultValue={q?.side ?? "blue"}
          options={[
            { value: "blue", label: "Blue" },
            { value: "red", label: "Red" },
          ]}
        />
        <Select
          label="Role to Fill"
          name="role"
          defaultValue={q?.role ?? "MIDDLE"}
          options={matchupRoles.map((r) => ({
            value: r,
            label: roles[r],
            icon: <RoleIcon role={r} />,
          }))}
        />
        <Input
          label="Blue Picks"
          name="blue"
          defaultValue={input.blue}
          placeholder="Ahri:MIDDLE, LeeSin:JUNGLE"
        />
        <Input label="Red Picks" name="red" defaultValue={input.red} placeholder="Nunu:JUNGLE" />
        <Input label="Bans" name="bans" defaultValue={input.bans} placeholder="Zed, Yasuo" />
        <Button type="submit">Rank Candidates</Button>
      </form>
      <p className="np-body-sm">
        Enter champion IDs separated by commas, with an optional role after a colon (TOP, JUNGLE,
        MIDDLE, BOTTOM or UTILITY). Roles let a pick count as your lane opponent or as an ally for
        synergy. The draft stays in this page’s URL.
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {a ? <Results assistant={a} /> : null}
      <details>
        <summary>How Candidates Are Ranked</summary>
        <p className="np-body-sm">
          Each part is measured in win-rate points above 50% and needs at least{" "}
          {matchupMinimumSample} observations; otherwise it is unknown.
        </p>
        <ul className="np-body-sm">
          <li>
            <strong>Matchup</strong>: the shrunk lane win rate against the enemy picked in the role
            to fill, from the stored lane matchups.
          </li>
          <li>
            <strong>Synergy</strong>: the mean shrunk duo delta (win rate minus the rate expected
            from both champions’ own win rates) with each ally whose role is known. Solo queue only.
          </li>
          <li>
            <strong>Blindability</strong>: the stored blindability score (lower-tail win rate), used
            only while the lane opponent is unknown.
          </li>
        </ul>
        <pre className="np-body-sm">{`score = mean of the known parts
part  = win rate − 50%`}</pre>
        <p className="np-body-sm">
          Unknown parts are left out of the mean rather than counted as zero; candidates with no
          known part rank last. Ties go to more lane games. Picked and banned champions are never
          candidates. These are stored samples, not predictions of a game’s result.
        </p>
      </details>
    </div>
  );
}

function Results({ assistant: a }: { assistant: DraftAssistant }) {
  return (
    <section className="np-stack" aria-labelledby="candidates">
      <h2 id="candidates">Candidates For {roles[a.query.role]}</h2>
      <p className="np-meta">
        Patch {a.patch ?? "unavailable"} ·{" "}
        {a.laneOpponent ? `Lane opponent: ${name(a.laneOpponent)}` : "Lane opponent unknown"} ·{" "}
        {a.synergyAllies.length
          ? `Synergy with ${a.synergyAllies.map(name).join(", ")}`
          : "No allies with a role for synergy"}
      </p>
      {a.unknownChampions.length ? (
        <p role="status">Not in the champion catalog, ignored: {a.unknownChampions.join(", ")}</p>
      ) : null}
      <Table
        caption={`Ranked candidates for ${roles[a.query.role]}`}
        rows={a.candidates.map((c, i) => ({ ...c, rank: i + 1 }))}
        getRowKey={(c) => String(c.champion.championKey)}
        emptyMessage="No stored scores for this role, source and patch yet."
        columns={[
          { id: "rank", header: "Rank", render: (c) => c.rank },
          {
            id: "champion",
            header: "Champion",
            render: (c: DraftCandidate) => (
              <ChampionIcon
                id={c.champion.championId ?? String(c.champion.championKey)}
                name={name(c.champion)}
                imageUrl={c.champion.imageUrl}
                size="small"
                href={
                  c.champion.championId
                    ? `/champions/${c.champion.championId}/matchups?source=${a.query.source}${a.patch ? `&patch=${a.patch}` : ""}&role=${a.query.role}`
                    : undefined
                }
              />
            ),
          },
          {
            id: "score",
            header: "Score",
            render: (c) => `${points(c.score)} · ${c.parts} known`,
          },
          { id: "matchup", header: "Matchup", render: (c) => part(c.matchup, "games") },
          { id: "synergy", header: "Synergy", render: (c) => part(c.synergy, "duo games") },
          {
            id: "blindability",
            header: "Blindability",
            render: (c) => part(c.blindability, "covered picks"),
          },
          { id: "games", header: "Lane Games", render: (c) => c.games },
          ...(a.draft?.model
            ? [
                {
                  id: "wp",
                  header: "Draft Win Probability if Picked",
                  render: (c: DraftCandidate) =>
                    c.winProbability === null
                      ? "Unknown"
                      : `${(c.winProbability * 100).toFixed(1)}%`,
                },
              ]
            : []),
        ]}
      />
      {a.draft ? (
        <DraftWinProbabilitySection
          value={a.draft}
          side={a.query.side}
          name={(key) => {
            const c =
              a.candidates.find((x) => x.champion.championKey === key)?.champion ??
              [a.laneOpponent, ...a.synergyAllies].find((x) => x?.championKey === key);
            return c ? name(c) : `Champion ${key}`;
          }}
        />
      ) : (
        <p className="np-meta">The draft win probability model covers solo queue only.</p>
      )}
    </section>
  );
}
