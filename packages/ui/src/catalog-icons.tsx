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

const laneLabels = new Map([
  ["all", "All Roles"],
  ["top", "Top"],
  ["jungle", "Jungle"],
  ["mid", "Mid"],
  ["bottom", "Bottom"],
  ["support", "Support"],
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
  const position = roleAliases.get(key) ?? key;
  const label = laneLabels.get(position);
  return (
    <span
      className="np-role-icon"
      data-position={label ? position : undefined}
      role="img"
      aria-label={label ?? "Unknown Role"}
      title={label ?? "Unknown Role"}
    >
      {label ? <span className="np-visually-hidden">{label}</span> : "—"}
    </span>
  );
}
