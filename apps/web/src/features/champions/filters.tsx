"use client";
import { Button, Select } from "@summonersnet/ui";
import { championRoles, tierListSorts, type TierList } from "@summonersnet/data/contracts";
import { roleLabels, sortLabels } from "./presentation";

const all = { label: "All", value: "all" };
interface Filters {
  source: "solo" | "pro";
  patch?: string | undefined;
  role: (typeof championRoles)[number];
  region?: string | undefined;
  tier?: string | undefined;
  sort?: (typeof tierListSorts)[number];
  order?: "asc" | "desc";
}
/** The shared GET filter form of the tier list and champion pages; "all" means no filter. */
export function ChampionFilters({
  action,
  query,
  facets,
  sortable = false,
}: {
  action: string;
  query: Filters | undefined;
  facets: TierList["facets"] | undefined;
  sortable?: boolean;
}) {
  return (
    <form action={action} method="get" className="ev-filters" key={JSON.stringify(query)}>
      <Select
        label="Source"
        name="source"
        defaultValue={query?.source ?? "solo"}
        options={[
          { label: "Solo queue", value: "solo" },
          { label: "Pro", value: "pro" },
        ]}
      />
      <Select
        label="Patch"
        name="patch"
        defaultValue={query?.patch ?? "all"}
        options={[
          { label: "Newest", value: "all" },
          ...(facets?.patches ?? []).map((p) => ({ label: p, value: p })),
        ]}
      />
      <Select
        label="Role"
        name="role"
        defaultValue={query?.role ?? "ALL"}
        options={championRoles.map((r) => ({ label: roleLabels[r], value: r }))}
      />
      <Select
        label="Region"
        name="region"
        defaultValue={query?.region ?? "all"}
        options={[all, ...(facets?.regions ?? []).map((r) => ({ label: r, value: r }))]}
      />
      <Select
        label="Tier"
        name="tier"
        defaultValue={query?.tier ?? "all"}
        options={[all, ...(facets?.tiers ?? []).map((t) => ({ label: t, value: t }))]}
      />
      {sortable && (
        <>
          <Select
            label="Sort by"
            name="sort"
            defaultValue={query?.sort ?? "games"}
            options={tierListSorts.map((s) => ({ label: sortLabels[s], value: s }))}
          />
          <Select
            label="Order"
            name="order"
            defaultValue={query?.order ?? "desc"}
            options={[
              { label: "Highest first", value: "desc" },
              { label: "Lowest first", value: "asc" },
            ]}
          />
        </>
      )}
      <Button type="submit">Apply filters</Button>
    </form>
  );
}
