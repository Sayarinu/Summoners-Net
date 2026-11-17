"use client";
import { ExportLink } from "../shell/export-link";
import { ChampionIcon, ItemIcon, Table, TextLink } from "@summonersnet/ui";
import type {
  PatchOverview,
  PatchChampion,
  PatchTrend,
  SampledValue,
} from "@summonersnet/data/contracts";
function rate(r: SampledValue) {
  return `${r.value === null ? "Unknown" : `${(r.value * 100).toFixed(1)}%`} · n=${r.sampleCount}`;
}
function Champion({
  champion: c,
  patch,
  source = "solo",
}: {
  champion: PatchChampion;
  patch: string;
  source?: "solo" | "pro";
}) {
  const name = c.name ?? c.championId ?? `Champion ${c.championKey}`;
  return (
    <span className="ev-champion">
      <ChampionIcon
        id={c.championId ?? String(c.championKey)}
        name={name}
        imageUrl={c.imageUrl}
        size="small"
      />
      {c.championId ? (
        <TextLink href={`/champions/${c.championId}?source=${source}&patch=${patch}`}>
          {name}
        </TextLink>
      ) : (
        name
      )}
    </span>
  );
}
function Trends({ title, rows, patch }: { title: string; rows: PatchTrend[]; patch: string }) {
  return (
    <section className="np-stack">
      <h2>{title}</h2>
      <ExportLink
        table="patch-trends"
        filters={{ patch }}
        label="Download Risers and Fallers as CSV"
      />
      <Table
        caption={`${title} in solo queue`}
        rows={rows}
        getRowKey={(r) => `${r.championKey}-${r.metric}`}
        emptyMessage="No qualifying changes: samples may be too small or changes may not be significant."
        columns={[
          {
            id: "champion",
            header: "Champion",
            render: (r) => <Champion champion={r} patch={patch} />,
          },
          {
            id: "metric",
            header: "Rate",
            render: (r) => (r.metric === "pick" ? "Pick Rate" : "Win Rate"),
          },
          { id: "current", header: "Current Patch", render: (r) => rate(r.change.current) },
          { id: "previous", header: "Previous Patch", render: (r) => rate(r.change.previous) },
          {
            id: "change",
            header: "Change",
            render: (r) =>
              r.change.delta === null
                ? "Unknown"
                : `${r.change.delta > 0 ? "+" : ""}${(r.change.delta * 100).toFixed(1)} pp`,
          },
        ]}
      />
    </section>
  );
}
export function PatchOverviewPage({ overview: o }: { overview: PatchOverview }) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Patch overview</span>
          <h1>Patch {o.patch}</h1>
          <p>
            Stored samples from this patch, compared with{" "}
            {o.previousPatch ?? "no preceding catalog patch"}.
          </p>
        </div>
      </header>
      <p>
        Solo queue trends combine all roles, regions and tiers in ranked solo games. Up to ten
        qualifying changes per direction, ranked by absolute percentage-point change.
      </p>
      <p>
        Both patches need at least 50 observations and five successes and failures. Trends use the
        same significance policy as{" "}
        <TextLink href={`/trending?patch=${o.patch}`}>Trending Champions</TextLink>, where source
        and role filters are available. These exploratory signals are not adjusted for multiple
        comparisons.
      </p>
      {!o.previousPatch ? (
        <p role="status">
          No preceding catalog patch is stored. Trends and new builds cannot be established.
        </p>
      ) : null}
      <Trends title="Biggest Risers" rows={o.risers} patch={o.patch} />
      <Trends title="Biggest Fallers" rows={o.fallers} patch={o.patch} />
      <section className="np-stack">
        <h2>New Popular Builds</h2>
        <p>
          Ranked solo three-item cores in purchase order, grouped by champion and role. A path needs
          at least 50 observations now and no observations among at least 50 cores for that champion
          and role in the preceding patch. Newly observed does not mean first ever used. Shares
          describe captured complete cores, not all games.
        </p>
        <ExportLink table="patch-builds" filters={{ patch: o.patch }} />
        <Table
          caption="Newly Observed Three-Item Cores"
          rows={o.builds}
          getRowKey={(r) => `${r.championKey}-${r.role}-${r.items.map((i) => i.id).join(",")}`}
          emptyMessage="No qualifying new builds. Both patches need enough complete core observations."
          columns={[
            {
              id: "champion",
              header: "Champion",
              render: (r) => <Champion champion={r} patch={o.patch} />,
            },
            { id: "role", header: "Role", render: (r) => r.role },
            {
              id: "items",
              header: "Purchase Order",
              render: (r) => (
                <ol>
                  {r.items.map((i) => (
                    <li key={i.id}>
                      <ItemIcon
                        id={i.catalogId}
                        name={i.name ?? `Item ${i.id}`}
                        imageUrl={i.imageUrl}
                        size="small"
                      />
                      {i.name ?? `Item ${i.id}`}
                    </li>
                  ))}
                </ol>
              ),
            },
            {
              id: "share",
              header: "Current Observations",
              render: (r) => `${r.games} cores · ${rate(r.share)}`,
            },
            {
              id: "previous",
              header: "Previous Observations",
              render: (r) => `Absent · n=${r.previousSample} cores`,
            },
          ]}
        />
      </section>
      <section className="np-stack">
        <h2>Pro Presence Leaders</h2>
        <p>
          Picks plus bans across stored complete pro drafts. At least ten drafts are required;
          samples below 50 are flagged. Up to ten champions.
        </p>
        <ExportLink table="patch-pro" filters={{ patch: o.patch }} />
        <Table
          caption="Pro Pick and Ban Presence"
          rows={o.pro}
          getRowKey={(r) => String(r.championKey)}
          emptyMessage="Too little pro draft data for presence leaders."
          columns={[
            {
              id: "champion",
              header: "Champion",
              render: (r) => <Champion champion={r} patch={o.patch} source="pro" />,
            },
            {
              id: "picks",
              header: "Picks",
              render: (r) => `${r.picks} · n=${r.presence.sampleCount} drafts`,
            },
            {
              id: "bans",
              header: "Bans",
              render: (r) => `${r.bans} · n=${r.presence.sampleCount} drafts`,
            },
            {
              id: "presence",
              header: "Presence",
              render: (r) =>
                `${rate(r.presence)}${r.sample === "low-sample" ? " · Low sample" : ""}`,
            },
          ]}
        />
      </section>
    </div>
  );
}
