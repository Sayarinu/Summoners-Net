"use client";
import { useState } from "react";
import { Button } from "@summonersnet/ui";
export function RefreshButton({
  kind,
  year,
}: {
  kind: "matches" | "running" | "rosters" | "metadata" | "history" | "entities";
  year?: number;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    setPending(true);
    try {
      const response = await fetch("/api/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...(year ? { year } : {}) }),
      });
      if (!response.ok) throw new Error();
      setMessage("Queued. The local worker will process this refresh.");
    } catch {
      setMessage("Could not queue refresh. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="ev-refresh">
      <Button
        onPress={() => {
          void refresh();
        }}
        loading={pending}
        disabled={pending}
      >
        {kind === "history"
          ? `Queue ${year} import`
          : kind === "entities"
            ? "Refresh identities & images"
            : "Refresh"}
      </Button>
      <span role="status" className="np-meta">
        {message}
      </span>
    </div>
  );
}
