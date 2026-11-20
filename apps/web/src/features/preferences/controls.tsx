"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Combobox,
  PageHeader,
  Panel,
  SpoilerControl,
  commonTimezones,
} from "@summonersnet/ui";
import { useRouter } from "next/navigation";
import {
  browserTimezone,
  preferencesChangedEvent,
  preferencesSchema,
  type Preferences,
} from "./model";

function timezoneOptions(current: string) {
  const values =
    typeof Intl.supportedValuesOf === "function"
      ? ["UTC", ...Intl.supportedValuesOf("timeZone")]
      : commonTimezones.map((timezone) => timezone.value);
  const unique = [...new Set(values)];
  if (!unique.includes(current)) unique.push(current);
  return unique.map((value) => ({ label: value, value }));
}

const timezoneDetectionKey = "summonersnet-timezone-detection";
type DetectionWindow = Window & { __summonersNetDetectedTimezone?: string };

/**
 * Saves preferences through the HTTP-only cookie route and tells open pages about the change.
 * Resolves to an error message, or an empty string on success.
 */
function useSavePreferences() {
  const router = useRouter();
  return useCallback(
    async (next: Preferences, refresh = true): Promise<string> => {
      if (!preferencesSchema.safeParse(next).success)
        return "Enter a valid IANA timezone, such as America/Phoenix.";
      try {
        const response = await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error();
        window.dispatchEvent(new CustomEvent(preferencesChangedEvent, { detail: next }));
        if (refresh) router.refresh();
        return "";
      } catch {
        return "Preferences could not be saved. Try again.";
      }
    },
    [router],
  );
}

/**
 * Stores the browser's timezone once for viewers who have not saved preferences, without
 * refreshing the page they are on.
 */
export function TimezoneDetector({ initial }: { initial: Preferences }) {
  const save = useSavePreferences();
  const attempted = useRef<string | undefined>(undefined);
  useEffect(() => {
    const timezone = browserTimezone();
    if (timezone === initial.timezone || attempted.current === timezone) return;
    attempted.current = timezone;
    const detectionWindow = window as DetectionWindow;
    if (detectionWindow.__summonersNetDetectedTimezone === timezone) return;
    try {
      if (window.sessionStorage.getItem(timezoneDetectionKey) === timezone) return;
      window.sessionStorage.setItem(timezoneDetectionKey, timezone);
    } catch {
      // Session storage may be unavailable; the window marker still prevents route loops.
    }
    detectionWindow.__summonersNetDetectedTimezone = timezone;
    void save({ ...initial, timezone }, false);
  }, [initial.hideSpoilers, initial.timezone, save]);
  return null;
}

export function SettingsPage({ initial }: { initial: Preferences }) {
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState("");
  const save = useSavePreferences();
  const options = useMemo(() => timezoneOptions(value.timezone), [value.timezone]);
  const saveAndReport = async (next: Preferences, saved: string) => {
    setValue(next);
    setMessage((await save(next)) || saved);
  };

  return (
    <div className="mx-auto flex w-full max-w-reading min-w-0 flex-col gap-6">
      <PageHeader eyebrow="Saved in This Browser" title="Settings" />
      <Panel title="Timezone">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveAndReport(value, "Timezone saved.");
          }}
          className="flex flex-wrap items-end gap-3 [&>:first-child]:min-w-[min(100%,260px)] [&>:first-child]:flex-1"
        >
          <Combobox
            defaultValue={value.timezone}
            label="Timezone"
            options={options}
            onSelectionChange={(timezone) => setValue({ ...value, timezone })}
            placeholder="Search Timezones"
          />
          <Button type="submit">Save Timezone</Button>
        </form>
      </Panel>
      <Panel title="Spoilers">
        <SpoilerControl
          hidden={value.hideSpoilers}
          onHiddenChange={(hideSpoilers) => {
            void saveAndReport(
              { ...value, hideSpoilers },
              hideSpoilers ? "Results are hidden." : "Results are shown.",
            );
          }}
        />
      </Panel>
      <p role="status" className="text-sm text-fg-secondary">
        {message}
      </p>
    </div>
  );
}
