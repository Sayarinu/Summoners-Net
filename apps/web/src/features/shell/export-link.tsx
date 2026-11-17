"use client";
import { TextLink } from "@summonersnet/ui";

/** A CSV download of an aggregate table with the filters the page is showing. */
export function ExportLink({
  table,
  filters,
  label = "Download CSV",
}: {
  table: string;
  filters: Record<string, string | number | null | undefined>;
  label?: string;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
  const query = params.toString();
  return (
    <TextLink href={`/api/export/${table}${query ? `?${query}` : ""}`} download>
      {label}
    </TextLink>
  );
}
