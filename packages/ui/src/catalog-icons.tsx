"use client";

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
      fallback={name}
      src={src}
      size={size}
      data-catalog-id={id}
      data-catalog-kind={kind}
    />
  );
}
export function ChampionIcon(props: CatalogIconProps) {
  return <CatalogIcon {...props} kind="champion" />;
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
