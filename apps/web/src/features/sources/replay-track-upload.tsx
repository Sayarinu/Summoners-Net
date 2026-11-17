"use client";
import { useState } from "react";
import { Button, Input } from "@summonersnet/ui";

export function ReplayTrackUpload() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function upload(form: HTMLFormElement) {
    setPending(true);
    try {
      const response = await fetch("/api/import?kind=replay-track", {
        method: "POST",
        body: new FormData(form),
      });
      if (!response.ok) throw new Error();
      setMessage("Track import queued. The worker will validate it; reload status after it runs.");
    } catch {
      setMessage("Track import could not be queued. Choose a JSON track file up to 64 MiB.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="np-stack">
      <h2>Import a Replay Track</h2>
      <p className="np-body-sm">
        Choose a version 1 track JSON from a completed replay. Re-importing replaces that game's
        track version; other games are kept. Invalid files leave saved tracks intact. Captured
        frames and capture manifests are not track files.
      </p>
      <form
        className="ev-import"
        onSubmit={(event) => {
          event.preventDefault();
          void upload(event.currentTarget);
        }}
      >
        <input type="hidden" name="kind" value="replay-track" />
        <Input
          label="Replay Track JSON"
          type="file"
          name="file"
          accept=".json,application/json"
          required
        />
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
          Queue Track Import
        </Button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
