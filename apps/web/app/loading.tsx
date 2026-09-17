import { Skeleton } from "@esportsviewer/ui";
export default function Loading() {
  return (
    <div className="np-stack" role="status" aria-label="Loading local records">
      <Skeleton height={44} />
      <Skeleton height={160} />
    </div>
  );
}
