"use client";
import { useState } from "react";
import { Button, Input, Select } from "@summonersnet/ui";
import { riotPlatforms } from "@summonersnet/data/contracts";
export function ReplayMetadataUpload() {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  async function upload(form: HTMLFormElement) {
    setPending(true);
    try {
      const response = await fetch("/api/import?kind=replay-metadata", {
        method: "POST",
        body: new FormData(form),
      });
      if (!response.ok) throw new Error();
      setMessage("Replay metadata import queued. Reload status after the worker runs.");
    } catch {
      setMessage("Replay import could not be queued. Choose a .rofl file up to 256 MiB.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="np-stack">
      <h2>Import Replay Metadata</h2>
      <p className="np-body-sm">
        Upload a .rofl file to read its version, length and end-of-game statistics. The worker does
        not decode game packets. Uploaded copies are deleted after processing unless replay
        retention is enabled. Your original file stays on your computer.
      </p>
      <p className="np-body-sm">
        Select the platform where the game was played, or leave it unknown. Legacy files can supply
        a game ID; ROFL2 metadata lacks a verified game ID and remains unlinked. Player names and
        filenames never establish a match link.
      </p>
      <form
        className="ev-import"
        onSubmit={(event) => {
          event.preventDefault();
          void upload(event.currentTarget);
        }}
      >
        <input type="hidden" name="kind" value="replay-metadata" />
        <Input label="Replay File" type="file" name="file" accept=".rofl" required />
        <Select
          label="Replay Platform"
          name="platform"
          defaultValue=""
          options={[
            { label: "Unknown — Keep Unlinked", value: "" },
            ...riotPlatforms.map((platform) => ({
              label: platform.toUpperCase(),
              value: platform,
            })),
          ]}
        />
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
          Queue Replay Metadata
        </Button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
