"use client";
import { useEffect, useState } from "react";
import { Button, FilterBar, Input, PageHeader, Panel, TextLink } from "@summonersnet/ui";
import {
  isSavablePath,
  readSavedViews,
  savedViewLimit,
  viewHref,
  writeSavedViews,
  type SavedView,
} from "./model";

const browserStorage = () => (typeof window === "undefined" ? null : window.localStorage);

/**
 * Saves the current page's filters in this browser and lists saved views. Nothing is sent to the
 * server. Without `path` it only lists and removes views.
 */
export function SavedViewsPanel({
  path,
  query,
  defaultName = "",
  title = "Saved Views",
  storage = browserStorage,
  now = () => new Date(),
}: {
  path?: string;
  /** The filters to save; the page's current query string when omitted. */
  query?: string;
  defaultName?: string;
  /** The panel title; a page that is only saved views names the list instead. */
  title?: string;
  storage?: () => Pick<Storage, "getItem" | "setItem"> | null;
  now?: () => Date;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    const store = storage();
    if (store) setViews(readSavedViews(store));
  }, [storage]);
  /** Writes the views; false when the browser has no storage or refuses the write. */
  const update = (next: SavedView[]) => {
    const store = storage();
    try {
      if (!store) throw new Error("No local storage");
      writeSavedViews(store, next);
      setViews(next);
      return true;
    } catch {
      setStatus("This browser would not store the view.");
      return false;
    }
  };
  const canSave = path !== undefined && isSavablePath(path);
  const save = (name: string) => {
    const at = now();
    const view: SavedView = {
      id: `v-${at.valueOf().toString(36)}`,
      name: name.trim().slice(0, 60),
      path: path!,
      query: (query ?? (typeof window === "undefined" ? "" : window.location.search))
        .replace(/^\?/, "")
        .slice(0, 1000),
      savedAt: at.toISOString(),
    };
    if (!view.name) return setStatus("Name the view first.");
    if (views.length >= savedViewLimit)
      return setStatus(`At most ${savedViewLimit} views can be saved; remove one first.`);
    if (update([view, ...views.filter((v) => v.id !== view.id)]))
      setStatus(`Saved "${view.name}" in this browser.`);
  };
  return (
    <Panel
      title={title}
      actions={path !== undefined ? <TextLink href="/saved-views">All Saved Views</TextLink> : null}
    >
      <div className="flex flex-col gap-4">
        {canSave ? (
          <FilterBar
            onSubmit={(e) => {
              e.preventDefault();
              const name = new FormData(e.currentTarget).get("name");
              save(typeof name === "string" ? name : "");
            }}
          >
            <Input label="View Name" name="name" defaultValue={defaultName} maxLength={60} />
            <Button type="submit">Save This View</Button>
          </FilterBar>
        ) : null}
        {status ? (
          <p role="status" className="text-sm text-fg-secondary">
            {status}
          </p>
        ) : null}
        {views.length ? (
          <ul aria-label="Saved Views" className="flex list-none flex-col divide-y divide-line">
            {views.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <TextLink href={viewHref(v)}>{v.name}</TextLink>
                  <span className="np-meta truncate text-fg-muted">{viewHref(v)}</span>
                </span>
                <Button
                  size="small"
                  variant="ghost"
                  aria-label={`Remove ${v.name}`}
                  onPress={() => update(views.filter((x) => x.id !== v.id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-fg-muted">No views are saved in this browser.</p>
        )}
      </div>
    </Panel>
  );
}

/** Every view saved in this browser, with nothing to save from. */
export function SavedViewsPage() {
  return (
    <div className="mx-auto flex w-full max-w-reading min-w-0 flex-col gap-6">
      <PageHeader eyebrow="Stored in This Browser" title="Saved Views" />
      <SavedViewsPanel title="Views in This Browser" />
    </div>
  );
}
