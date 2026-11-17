"use client";
import { useEffect, useState } from "react";
import { Button, Input, TextLink } from "@summonersnet/ui";
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
  storage = browserStorage,
  now = () => new Date(),
}: {
  path?: string;
  /** The filters to save; the page's current query string when omitted. */
  query?: string;
  defaultName?: string;
  storage?: () => Pick<Storage, "getItem" | "setItem"> | null;
  now?: () => Date;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [name, setName] = useState(defaultName);
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
  const save = () => {
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
    <section className="np-stack" aria-labelledby="saved-views-heading">
      <h2 id="saved-views-heading">Saved Views</h2>
      {path !== undefined ? <TextLink href="/saved-views">All Saved Views</TextLink> : null}
      {canSave ? (
        <form
          className="ev-filters"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Input
            label="View Name"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <Button type="submit">Save This View</Button>
        </form>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
      {views.length ? (
        <ul aria-label="Saved Views">
          {views.map((v) => (
            <li key={v.id}>
              <TextLink href={viewHref(v)}>{v.name}</TextLink>{" "}
              <span className="np-meta">{viewHref(v)}</span>{" "}
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
        <p className="np-meta">No views are saved in this browser.</p>
      )}
    </section>
  );
}
