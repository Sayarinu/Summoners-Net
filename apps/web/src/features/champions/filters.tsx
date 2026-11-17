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
}: {
  action: string;
  query: Filters | undefined;
  facets: TierList["facets"] | undefined;
  sortable?: boolean;
  scopeOnly?: boolean;
}) {
  return (
    <form
      action={action}
      method="get"
      className={`ev-filters${scopeOnly ? " ev-filters--compact" : ""}`}
      key={JSON.stringify(query)}
    >
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
          options={championRoles.map((r) => ({ label: roleLabels[r], value: r }))}
        />
      )}
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
            label="Sort By"
            name="sort"
            defaultValue={query?.sort ?? "games"}
            options={tierListSorts.map((s) => ({ label: sortLabels[s], value: s }))}
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
    </form>
  );
}
