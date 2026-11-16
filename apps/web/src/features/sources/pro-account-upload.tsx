"use client";
import { useState } from "react";
import { Button, Input } from "@summonersnet/ui";
export function ProAccountUpload() {
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  async function upload(form: HTMLFormElement) {
    setPending(true);
    try {
      const response = await fetch("/api/import?kind=pro-account-links", {
        method: "POST",
        body: new FormData(form),
      });
      if (!response.ok) throw new Error();
      setMessage(
        "Pro account link import queued. Reload status after the local worker validates it.",
      );
    } catch {
      setMessage(
        "Pro account links could not be queued. Choose a version 1 JSON file up to 5 MiB.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="np-stack">
      <h2>Import pro account links</h2>
      <p className="np-body-sm">
        Choose a version 1 link file with each account's PUUID, a stored pro player's source and
        source ID, and supporting source URLs. Names alone never create a link. Evidence is supplied
        by the file's author; URLs are not fetched or independently verified.
      </p>
      <p className="np-body-sm">
        The whole file must validate. Conflicting player links are rejected, and links missing from
        a newer file are kept.
      </p>
      <form
        className="ev-import"
        onSubmit={(event) => {
          event.preventDefault();
          void upload(event.currentTarget);
        }}
      >
        <input type="hidden" name="kind" value="pro-account-links" />
        <Input
          label="Pro account link JSON"
          type="file"
          name="file"
          accept=".json,application/json"
          required
        />
        <Button type="submit" variant="primary" loading={pending} disabled={pending}>
          Queue pro account links
        </Button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
