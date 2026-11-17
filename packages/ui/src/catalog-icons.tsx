"use client";

import { TextLink } from "./primitives.js";
import { Avatar, type AvatarProps } from "./internal.js";

/** Pass a catalog entry from the application's catalogIcons query. */
export interface CatalogIconProps {
  readonly id: string;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly size?: AvatarProps["size"];
}
function CatalogIcon({
  id,
  name,
  imageUrl,
  size = "medium",
  kind,
}: CatalogIconProps & { kind: string }) {
  const src =
    imageUrl &&
    /^\/api\/images\/(?:[a-f0-9]{64}|catalog\/\d{1,3}\.\d{1,3}\/(?:champion|item|rune|spell)\/[A-Za-z0-9]{1,100})$/.test(
      imageUrl,
    )
      ? imageUrl
      : undefined;
  return (
    <Avatar
      alt={name}
      title={name}
      fallback={name}
      src={src}
      size={size}
      data-catalog-id={id}
      data-catalog-kind={kind}
    />
  );
}
export function ChampionIcon({
  href,
  ...props
}: CatalogIconProps & { readonly href?: string | undefined }) {
  const icon = <CatalogIcon {...props} kind="champion" />;
  return href ? <TextLink href={href}>{icon}</TextLink> : icon;
}
export function ItemIcon(props: CatalogIconProps) {
  return <CatalogIcon {...props} kind="item" />;
}
export function RuneIcon(props: CatalogIconProps) {
  return <CatalogIcon {...props} kind="rune" />;
}
export function SummonerSpellIcon(props: CatalogIconProps) {
  return <CatalogIcon {...props} kind="spell" />;
}

const lanePaths = new Map([
  ["all", { label: "All Roles", path: "M6 6h4v4H6zm8 0h4v4h-4zm-8 8h4v4H6zm8 0h4v4h-4z" }],
  ["top", { label: "Top", path: "M3 16V3h13l-4 4H7v5z" }],
  [
    "jungle",
    {
      label: "Jungle",
      path: "M12 21c-4-4-8-7-9-13 4 1 6 3 7 6L12 3l2 11c1-3 3-5 7-6-1 6-5 9-9 13z",
    },
  ],
  ["mid", { label: "Mid", path: "M4 16 16 4h4v4L8 20H4z" }],
  ["bottom", { label: "Bottom", path: "M21 8v13H8l4-4h5v-5z" }],
  ["support", { label: "Support", path: "m12 3 3 5 7-2-3 6-4 1 1 4-4 4-4-4 1-4-4-1-3-6 7 2z" }],
]);

const roleAliases = new Map([
  ["middle", "mid"],
  ["jng", "jungle"],
  ["jun", "jungle"],
  ["adc", "bottom"],
  ["bot", "bottom"],
  ["utility", "support"],
  ["sup", "support"],
]);

export function RoleIcon({ role }: { readonly role: string | null | undefined }) {
  const key = role?.toLowerCase() ?? "";
  const lane = lanePaths.get(roleAliases.get(key) ?? key);
  if (!lane)
    return (
      <span title="Unknown Role" role="img" aria-label="Unknown Role">
        —
      </span>
    );
  return (
    <svg
      aria-label={lane.label}
      className="np-role-icon"
      fill="currentColor"
      role="img"
      viewBox="0 0 24 24"
      width="20"
      height="20"
    >
      <title>{lane.label}</title>
      {lane.label !== "Jungle" && lane.label !== "Support" && (
        <path d="M3 3h18v18H3z" fill="none" stroke="currentColor" strokeOpacity=".35" />
      )}
      <path d={lane.path} />
    </svg>
  );
}
