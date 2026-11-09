"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Combobox, SpoilerControl, commonTimezones } from "@summonersnet/ui";
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

export function PreferencesControl({
  autoDetectTimezone = false,
  initial,
  showLabel = false,
}: {
  autoDetectTimezone?: boolean;
  initial: Preferences;
  showLabel?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState("");
  const autoDetectAttempted = useRef<string | undefined>(undefined);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const options = useMemo(() => timezoneOptions(value.timezone), [value.timezone]);

  const save = useCallback(
    async (next: Preferences, refresh = true) => {
      setValue(next);
      if (!preferencesSchema.safeParse(next).success) {
        setMessage("Enter a valid IANA timezone, such as America/Phoenix.");
        return;
      }
      try {
        const response = await fetch("/api/preferences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) throw new Error();
        detailsRef.current?.removeAttribute("open");
        window.dispatchEvent(new CustomEvent(preferencesChangedEvent, { detail: next }));
        if (refresh) router.refresh();
      } catch {
        setMessage("Preferences could not be saved. Try again.");
      }
    },
    [router],
  );

  useEffect(() => {
    if (!autoDetectTimezone) return;
    const timezone = browserTimezone();
    if (timezone === initial.timezone || autoDetectAttempted.current === timezone) return;
    autoDetectAttempted.current = timezone;
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
  }, [autoDetectTimezone, initial.hideSpoilers, initial.timezone, save]);

  return (
    <details className="ev-preferences" ref={detailsRef}>
      <summary aria-label={showLabel ? "Settings" : "Preferences"} role="button">
        <span aria-hidden="true" className="ev-preferences__icon">
          ⚙
        </span>
        {showLabel ? <span className="ev-preferences__label">Settings</span> : null}
        <span className="np-visually-hidden">{showLabel ? "Settings" : "Preferences"}</span>
      </summary>
      <div className="ev-preferences-panel np-stack">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(value);
          }}
          className="np-stack"
        >
          <Combobox
            defaultValue={value.timezone}
            label="Timezone"
            options={options}
            onSelectionChange={(timezone) => setValue({ ...value, timezone })}
            placeholder="Search timezones"
          />
          <Button type="submit">Save timezone</Button>
        </form>
        <SpoilerControl
          hidden={value.hideSpoilers}
          onHiddenChange={(hideSpoilers) => {
            void save({ ...value, hideSpoilers });
          }}
        />
        <p role="status">{message}</p>
      </div>
    </details>
  );
}
