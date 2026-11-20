"use client";
import { ExportLink } from "../shell/export-link";
import {
  ChampionIcon,
  ItemIcon,
  PageHeader,
  Panel,
  RoleIcon,
  Table,
  TextLink,
} from "@summonersnet/ui";
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
    <ChampionIcon
      id={c.championId ?? String(c.championKey)}
      name={name}
      imageUrl={c.imageUrl}
      size="small"
      href={c.championId ? `/champions/${c.championId}?source=${source}&patch=${patch}` : undefined}
    />
  );
}
function Trends({
  title,
  rows,
  patch,
  download,
}: {
  title: string;
  rows: PatchTrend[];
  patch: string;
  download: boolean;
}) {
  return (
    <Panel
      title={title}
      padding="none"
      actions={
        download ? (
          <ExportLink
            table="patch-trends"
            filters={{ patch }}
            label="Download Risers and Fallers as CSV"
          />
        ) : null
      }
    >
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
            align: "end",
            render: (r) =>
              r.change.delta === null
                ? "Unknown"
                : `${r.change.delta > 0 ? "+" : ""}${(r.change.delta * 100).toFixed(1)} pp`,
          },
        ]}
      />
    </Panel>
  );
}
export function PatchOverviewPage({ overview: o }: { overview: PatchOverview }) {
  return (
    <div className="mx-auto flex w-full max-w-content min-w-0 flex-col gap-6">
      <PageHeader
        breadcrumbs={[{ label: "Patches", href: "/patches" }, { label: `Patch ${o.patch}` }]}
        eyebrow={o.previousPatch ? `Previous Patch ${o.previousPatch}` : "No Previous Patch"}
        title={`Patch ${o.patch}`}
        actions={<TextLink href={`/trending?patch=${o.patch}`}>Trending Champions</TextLink>}
      >
        {!o.previousPatch ? (
          <p role="status" className="text-sm text-fg-secondary">
            No preceding catalog patch is stored. Trends and new builds cannot be established.
          </p>
        ) : null}
      </PageHeader>
      <div className="grid grid-cols-2 items-start gap-4 max-[1150px]:grid-cols-1">
        <Trends title="Biggest Risers" rows={o.risers} patch={o.patch} download />
        <Trends title="Biggest Fallers" rows={o.fallers} patch={o.patch} download={false} />
      </div>
      <Panel
        title="New Popular Builds"
        padding="none"
        actions={<ExportLink table="patch-builds" filters={{ patch: o.patch }} />}
      >
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
            { id: "role", header: "Role", render: (r) => <RoleIcon role={r.role} /> },
            {
              id: "items",
              header: "Purchase Order",
              render: (r) => (
                <ol className="flex list-none flex-wrap gap-x-3 gap-y-1">
                  {r.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-1.5">
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
      </Panel>
      <Panel
        title="Pro Presence Leaders"
        padding="none"
        actions={<ExportLink table="patch-pro" filters={{ patch: o.patch }} />}
      >
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
      </Panel>
    </div>
  );
}
