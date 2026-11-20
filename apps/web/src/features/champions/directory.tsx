"use client";
import { useState } from "react";
import {
  Card,
  ChampionIdentity,
  EmptyState,
  FilterBar,
  Input,
  PageHeader,
  Panel,
  RoleIcon,
  TabNav,
  TextLink,
} from "@summonersnet/ui";
import { matchupRoles, type ChampionDirectory } from "@summonersnet/data/contracts";
import { roleLabels } from "./presentation";

/** The champion section's sibling pages, shown as tabs on each of them. */
export function ChampionViews({ current }: { current: "champions" | "tier-list" | "trending" }) {
  return (
    <TabNav
      label="Champion Views"
      items={[
        { href: "/champions", label: "Champions", current: current === "champions" },
        { href: "/tier-list", label: "Tier List", current: current === "tier-list" },
        { href: "/trending", label: "Trending", current: current === "trending" },
      ]}
    />
  );
}

/** Every catalog champion as a card, filtered by name in place, and the role matchup pages. */
export function ChampionsPage({ directory: d }: { directory: ChampionDirectory }) {
  const [search, setSearch] = useState("");
  const term = search.trim().toLocaleLowerCase();
  const shown = term
    ? d.champions.filter(
        (c) =>
          c.name.toLocaleLowerCase().includes(term) ||
          c.championId.toLocaleLowerCase().includes(term),
      )
    : d.champions;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        title="Champions"
        eyebrow={`${d.patch ? `Catalog Patch ${d.patch}` : "Catalog"} · ${d.champions.length} champions`}
        actions={<TextLink href="/drafts/assistant">Draft Assistant</TextLink>}
      >
        <ChampionViews current="champions" />
      </PageHeader>
      <Panel title="Matchups by Role">
        <ul className="grid list-none grid-cols-5 gap-3 max-[1150px]:grid-cols-3 max-[700px]:grid-cols-2">
          {matchupRoles.map((r) => (
            <li key={r} className="flex flex-col gap-1">
              <span className="flex items-center gap-2 text-sm font-medium">
                <RoleIcon role={r} />
                {roleLabels[r]}
              </span>
              <span className="flex flex-wrap gap-x-3 text-sm">
                <TextLink href={`/matchups/${r}`} aria-label={`${roleLabels[r]} Matchup Matrix`}>
                  Matrix
                </TextLink>
                <TextLink
                  href={`/matchups/${r}/counter-picks`}
                  aria-label={`${roleLabels[r]} Counter-Pick Values`}
                >
                  Counter Picks
                </TextLink>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      {d.champions.length ? (
        <>
          <FilterBar
            className="border-y border-line py-3"
            role="search"
            onSubmit={(event) => event.preventDefault()}
          >
            <Input
              type="search"
              label="Search Champions"
              name="q"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Champion name"
            />
          </FilterBar>
          {shown.length ? (
            <ul
              aria-label="Champions in the Catalog"
              className="grid list-none grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 max-[600px]:grid-cols-2"
            >
              {shown.map((c) => (
                <li key={c.championId}>
                  <Card
                    href={`/champions/${encodeURIComponent(c.championId)}`}
                    className="max-[600px]:p-3"
                  >
                    <ChampionIdentity
                      id={c.championId}
                      name={c.name}
                      imageUrl={c.imageUrl}
                      size="large"
                    />
                  </Card>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No Champions Match This Search" />
          )}
        </>
      ) : (
        <EmptyState
          title="No Champion Catalog Yet"
          description="The catalog arrives with the first metadata synchronization."
        />
      )}
    </div>
  );
}
