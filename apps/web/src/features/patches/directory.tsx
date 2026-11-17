"use client";
import { EmptyState, Table, TextLink } from "@summonersnet/ui";
import type { PatchDirectory } from "@summonersnet/data/contracts";

/** Patches with stored champion aggregates, newest first. */
export function PatchesPage({ directory: d }: { directory: PatchDirectory }) {
  return (
    <div className="np-stack">
      <header className="ev-title">
        <div>
          <span className="np-overline">Stored aggregates</span>
          <h1>Patches</h1>
        </div>
      </header>
      <p>
        Each patch overview shows the biggest changes, newly observed builds and pro presence. See{" "}
        <TextLink href="/trending">Trending champions</TextLink> to compare any patch with the one
        before it.
      </p>
      {d.patches.length ? (
        <Table
          caption="Patches with champion statistics"
          rows={d.patches}
          getRowKey={(p) => p.patch}
          columns={[
            {
              id: "patch",
              header: "Patch",
              render: (p) => <TextLink href={`/patches/${p.patch}`}>Patch {p.patch}</TextLink>,
            },
            {
              id: "sources",
              header: "Sources",
              render: (p) =>
                [p.solo ? "Solo queue" : null, p.pro ? "Pro" : null].filter(Boolean).join(" · "),
            },
          ]}
        />
      ) : (
        <EmptyState
          title="No patch statistics yet"
          description={
            <span>
              Patches appear once games are ingested and aggregated. See{" "}
              <TextLink href="/sources">Sources</TextLink>.
            </span>
          }
        />
      )}
    </div>
  );
}
