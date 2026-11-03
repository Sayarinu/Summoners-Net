import type { ReactNode } from "react";
// A template remounts on every navigation, so the page entrance animation replays for each page,
// including search-parameter changes within the same route.
export default function Template({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
