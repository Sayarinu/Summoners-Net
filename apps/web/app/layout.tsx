import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./layers.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@summonersnet/tokens/generated/tokens.css";
import "@summonersnet/ui/styles.css";
import "./tailwind.css";
import { ShellHeader } from "../src/features/shell/shell";
import { SoftNavigation } from "../src/features/shell/soft-navigation";
import { preferencesState } from "../src/server/data";
export const metadata: Metadata = {
  title: { default: "Summoners Net", template: "%s · Summoners Net" },
  description: "League of Legends esports schedules, results and analytics.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: ReactNode }) {
  const preferenceState = await preferencesState();
  return (
    <html lang="en">
      <body>
        <SoftNavigation />
        <ShellHeader
          autoDetectTimezone={!preferenceState.hasSavedPreferences}
          preferences={preferenceState.value}
        />
        <main
          id="main-content"
          className="ml-[240px] scroll-mt-[90px] px-[clamp(var(--space-4),2vw,var(--space-8))] pt-8 pb-16 *:animate-[np-enter_var(--motion-duration-standard)_var(--motion-easing-enter)_both] motion-reduce:*:animate-none max-[850px]:ml-0 max-[850px]:scroll-mt-[72px] max-[850px]:px-3 max-[850px]:pt-5 max-[850px]:pb-12"
          tabIndex={-1}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
