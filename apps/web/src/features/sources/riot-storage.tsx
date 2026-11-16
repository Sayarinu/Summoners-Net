import { Table } from "@summonersnet/ui";
import type { RiotStorageStatus } from "@summonersnet/data";
import { dateTime } from "../browse/presentation";

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

export function RiotStorageSection({
  storage,
  timezone,
}: {
  storage: RiotStorageStatus;
  timezone: string;
}) {
  return (
    <section className="np-stack" aria-labelledby="riot-storage-heading">
      <h2 id="riot-storage-heading">Solo-queue storage</h2>
      <p className="np-body-sm">
        {storage.previousPatches === null
          ? "Retention has not run yet. The worker applies RIOT_RETAIN_PATCHES daily."
          : `Keeping the current patch and ${storage.previousPatches} previous ${
              storage.previousPatches === 1 ? "patch" : "patches"
            }${storage.keptPatches.length ? ` (${storage.keptPatches.join(", ")})` : ""}. Set RIOT_RETAIN_PATCHES to change it.`}
      </p>
      {storage.patches.length ? (
        <Table
          caption="Solo-queue data per patch"
          rows={storage.patches}
          getRowKey={(p) => p.patchKey ?? "unknown"}
          columns={[
            { id: "patch", header: "Patch", render: (p) => p.patchKey ?? "Unknown version" },
            { id: "matches", header: "Matches", render: (p) => p.matches },
            { id: "timelines", header: "Timelines", render: (p) => p.timelines },
            {
              id: "size",
              header: "Estimated size",
              render: (p) => formatBytes(p.estimatedBytes),
            },
          ]}
        />
      ) : (
        <p className="np-meta">No solo-queue matches stored yet.</p>
      )}
      {storage.lastRunAt && (
        <p className="np-meta">
          Last retention run {dateTime(storage.lastRunAt, timezone)}: {storage.prunedMatches}{" "}
          pruned, {storage.backfilledMatches} queued to refetch.
        </p>
      )}
    </section>
  );
}
