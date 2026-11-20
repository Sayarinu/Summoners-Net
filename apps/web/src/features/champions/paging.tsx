"use client";
import type { ReactNode } from "react";
import { Pagination } from "@summonersnet/ui";

/** The row count and page links under a paged table, matching the browse pages' footer. */
export function PageFooter({
  summary,
  label,
  page,
  total,
  pageSize,
  onPageChange,
}: {
  summary: ReactNode;
  label: string;
  page: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
      <span className="np-meta text-accent">{summary}</span>
      <Pagination
        label={label}
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(total / pageSize))}
        onPageChange={onPageChange}
      />
    </div>
  );
}

/** Moves to another page of a server-rendered list, keeping every other URL filter. */
export function goToPage(field: string, page: number) {
  const url = new URL(window.location.href);
  url.searchParams.set(field, String(page));
  window.location.assign(url.toString());
}
