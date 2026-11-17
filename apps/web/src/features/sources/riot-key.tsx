import { StatusIndicator } from "@summonersnet/ui";
import type { RiotKeyStatus } from "@summonersnet/data";
import { dateTime } from "../browse/presentation";
import { RefreshButton } from "./refresh";

const states = {
  missing: { label: "Not Configured", tone: "neutral" },
  untested: { label: "Untested", tone: "info" },
  valid: { label: "Valid", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
} as const;

export function RiotKeySection({
  riotKey,
  timezone,
}: {
  riotKey: RiotKeyStatus;
  timezone: string;
}) {
  const state = states[riotKey.state];
  return (
    <section className="np-stack" aria-labelledby="riot-key-heading">
      <h2 id="riot-key-heading">Riot API Key</h2>
      <p className="np-body-sm">
        Solo-queue data needs <code>RIOT_API_KEY</code> in the ignored <code>.env</code>. Only the
        worker reads it and checks it with one request; this page never contacts Riot.
      </p>
      <p>
        <StatusIndicator label={state.label} tone={state.tone} />
      </p>
      <p className="np-meta">
        {riotKey.state === "missing"
          ? "Riot jobs are skipped until a key is set. Other sources are unaffected."
          : riotKey.checkedAt
            ? `Last checked ${dateTime(riotKey.checkedAt, timezone)}.`
            : "Not checked yet. The worker checks a new key on its next run."}
        {riotKey.detail && riotKey.state !== "missing" ? ` ${riotKey.detail}` : ""}
      </p>
      {riotKey.expiresAt && riotKey.setAt && (
        <p className="np-meta">
          This development key was first seen {dateTime(riotKey.setAt, timezone)}. Development keys
          expire after 24 hours: generate a new one and update <code>RIOT_API_KEY</code> by{" "}
          {dateTime(riotKey.expiresAt, timezone)}.
        </p>
      )}
      {riotKey.state !== "missing" && <RefreshButton kind="riot-key" />}
    </section>
  );
}
