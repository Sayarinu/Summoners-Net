"use client";
import { Card, CardLink, EmptyState, PageHeader, TextLink } from "@summonersnet/ui";
import type { PatchDirectory } from "@summonersnet/data/contracts";

/** Patches with stored champion aggregates, newest first. */
export function PatchesPage({ directory: d }: { directory: PatchDirectory }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Patches"
        actions={<TextLink href="/trending">Trending Champions</TextLink>}
      >
        <p className="text-sm text-fg-secondary">
          Each patch overview shows the biggest changes, newly observed builds and pro presence.
        </p>
      </PageHeader>
      {d.patches.length ? (
        <ul
          aria-label="Patches with Champion Statistics"
          className="grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3"
        >
          {d.patches.map((p) => (
            <li key={p.patch}>
              <Card className="gap-1">
                <CardLink href={`/patches/${p.patch}`} className="text-lg font-medium">
                  Patch {p.patch}
                </CardLink>
                <span className="np-meta text-fg-muted">
                  {[p.solo ? "Solo Queue" : null, p.pro ? "Pro" : null].filter(Boolean).join(" · ")}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title="No Patch Statistics Yet"
          description="Patches appear once games are stored and aggregated."
        />
      )}
    </div>
  );
}
