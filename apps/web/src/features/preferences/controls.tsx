"use client";
import { useState } from "react";
import { Button, Input, SpoilerControl } from "@esportsviewer/ui";
import { preferencesSchema, type Preferences } from "./model";
export function PreferencesControl({ initial }: { initial: Preferences }) {
  const [value, setValue] = useState(initial);
  const [message, setMessage] = useState("");
  async function save(next: Preferences) {
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
      window.location.reload();
    } catch {
      setMessage("Preferences could not be saved. Try again.");
    }
  }
  return (
    <details className="ev-preferences">
      <summary>Preferences · {initial.timezone}</summary>
      <div className="ev-preferences-panel np-stack">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save(value);
          }}
          className="np-stack"
        >
          <Input
            label="Timezone"
            value={value.timezone}
            onChange={(e) => setValue({ ...value, timezone: e.target.value })}
            description="Use an IANA name, for example America/Phoenix."
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
