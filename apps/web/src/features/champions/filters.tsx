"use client";
import { RoleIcon, Button, FilterBar, Select } from "@summonersnet/ui";
import { championRoles, tierListSorts, type TierList } from "@summonersnet/data/contracts";
import { roleLabels, sortLabels } from "./presentation";

const all = { label: "All", value: "all" };
const performanceSorts = new Set<string>(["kda", "damagePerMinute", "goldDiffAt15"]);
interface Filters {
  source: "solo" | "pro";
  patch?: string | undefined;
  role: (typeof championRoles)[number];
  region?: string | undefined;
  tier?: string | undefined;
  sort?: (typeof tierListSorts)[number];
  order?: "asc" | "desc";
}
/**
 * The shared GET filter form of the tier list and champion pages; "all" means no filter. With
 * `scopeOnly`, source and role are chosen by tabs elsewhere and carried as hidden fields.
 */
export function ChampionFilters({
  action,
  query,
  facets,
  sortable = false,
  scopeOnly = false,
  className,
}: {
  action: string;
  query: Filters | undefined;
  facets: TierList["facets"] | undefined;
  sortable?: boolean;
  scopeOnly?: boolean;
  className?: string;
}) {
  const pro = query?.source === "pro";
  return (
    <FilterBar action={action} method="get" className={className} key={JSON.stringify(query)}>
      {scopeOnly ? (
        <>
          <input type="hidden" name="source" value={query?.source ?? "solo"} />
          <input type="hidden" name="role" value={query?.role ?? "ALL"} />
        </>
      ) : (
        <Select
          label="Source"
          name="source"
          defaultValue={query?.source ?? "solo"}
          options={[
            { label: "Solo Queue", value: "solo" },
            { label: "Pro", value: "pro" },
          ]}
        />
      )}
      <Select
        label="Patch"
        name="patch"
        defaultValue={query?.patch ?? "all"}
        options={[
          { label: "Newest", value: "all" },
          ...(facets?.patches ?? []).map((p) => ({ label: p, value: p })),
        ]}
      />
      {scopeOnly ? null : (
        <Select
          label="Role"
          name="role"
          defaultValue={query?.role ?? "ALL"}
          options={championRoles.map((r) => ({
            label: roleLabels[r],
            value: r,
            icon: <RoleIcon role={r} />,
          }))}
        />
      )}
      {/* Pro play is sliced by league, and its only tier is PRO. */}
      <Select
        label={pro ? "League" : "Region"}
        name="region"
        defaultValue={query?.region ?? "all"}
        options={[all, ...(facets?.regions ?? []).map((r) => ({ label: r, value: r }))]}
      />
      {pro ? null : (
        <Select
          label="Tier"
          name="tier"
          defaultValue={query?.tier ?? "all"}
          options={[all, ...(facets?.tiers ?? []).map((t) => ({ label: t, value: t }))]}
        />
      )}
      {sortable && (
        <>
          <Select
            label="Sort By"
            name="sort"
            defaultValue={query?.sort ?? "games"}
            // Performance sorts need per-game rows, which only pro play has so far.
            options={tierListSorts
              .filter((s) => pro || !performanceSorts.has(s))
              .map((s) => ({ label: sortLabels[s], value: s }))}
          />
          <Select
            label="Order"
            name="order"
            defaultValue={query?.order ?? "desc"}
            options={[
              { label: "Highest First", value: "desc" },
              { label: "Lowest First", value: "asc" },
            ]}
          />
        </>
      )}
      <Button type="submit">Apply Filters</Button>
    </FilterBar>
  );
}
