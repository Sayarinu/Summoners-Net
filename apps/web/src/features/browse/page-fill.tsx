"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { directoryPageSize } from "@summonersnet/data/contracts";

/** Whole rows of `columns` cards that fit in `available` pixels, within the directory bounds. */
export function wholeRowPageSize({
  available,
  rowHeight,
  rowGap,
  columns,
}: {
  available: number;
  rowHeight: number;
  rowGap: number;
  columns: number;
}) {
  const cols = Math.max(1, Math.floor(columns));
  const rows = rowHeight > 0 ? Math.floor((available + rowGap) / (rowHeight + rowGap)) : 1;
  // A grid that starts below a short viewport still gets a useful page of at least six cards.
  const minRows = Math.ceil(6 / cols);
  const maxRows = Math.max(1, Math.floor(directoryPageSize.max / cols));
  return Math.min(Math.max(rows, minRows), maxRows) * cols;
}

/** Keeps the first card of the current page on the resized page. */
export function pageForSize(page: number, pageSize: number, nextSize: number) {
  return Math.floor(((page - 1) * pageSize) / nextSize) + 1;
}

/** Measures the rendered grid: its columns, tallest row and the room left above the page's end. */
function measure(grid: HTMLElement) {
  const style = getComputedStyle(grid);
  const columns = style.gridTemplateColumns.split(" ").filter(Boolean).length;
  const rows = style.gridTemplateRows
    .split(" ")
    .map((track) => Number.parseFloat(track))
    .filter((track) => Number.isFinite(track));
  const rowHeight = Math.max(0, ...rows);
  const rowGap = Number.parseFloat(style.rowGap) || 0;
  const box = grid.getBoundingClientRect();
  // Content after the grid, such as pagination, stays on screen below the last row.
  const last = grid.parentElement?.lastElementChild;
  const below = last && last !== grid ? last.getBoundingClientRect().bottom - box.bottom : 0;
  const available = window.innerHeight - (box.top + window.scrollY) - below;
  return { columns, rowHeight, rowGap, available };
}

// The last automatic size per path and viewport: a page this grid sized is not resized again
// until the viewport changes, so rows of uneven height never bounce between two sizes.
let applied: { key: string; size: number } | undefined;

/**
 * A directory card grid whose page size fills the visible area with whole rows. Without
 * JavaScript, or until it measures, the server's default page size renders.
 */
export function FillingGrid({
  className,
  label,
  page,
  pageSize,
  total,
  children,
}: {
  className: string;
  /** Names the list, such as "Teams", so it can be found by name. */
  label: string;
  page: number;
  pageSize: number;
  total: number;
  children: ReactNode;
}) {
  const grid = useRef<HTMLUListElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    let timer: number | undefined;
    const fit = () => {
      const element = grid.current;
      if (!element?.childElementCount || window.location.pathname !== pathname) return;
      const size = wholeRowPageSize(measure(element));
      const key = `${pathname} ${window.innerWidth}x${window.innerHeight}`;
      // A page that already holds every record looks the same at either size.
      const unchanged = size === pageSize || (total <= pageSize && total <= size);
      if (unchanged || (applied?.key === key && applied.size === pageSize)) return;
      applied = { key, size };
      const params = new URLSearchParams(window.location.search);
      params.set("pageSize", String(size));
      const next = pageForSize(page, pageSize, size);
      if (next > 1) params.set("page", String(next));
      else params.delete("page");
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(fit, 150);
    };
    fit();
    window.addEventListener("resize", schedule);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", schedule);
    };
  }, [page, pageSize, pathname, router, total]);
  return (
    <ul aria-label={label} ref={grid} className={className}>
      {children}
    </ul>
  );
}
