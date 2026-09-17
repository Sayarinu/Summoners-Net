import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./layers.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@esportsviewer/tokens/generated/tokens.css";
import "@esportsviewer/ui/styles.css";
import "./globals.css";
import { ShellHeader, ShellFooter } from "../src/features/shell/shell";
import { preferences } from "../src/server/data";
export const metadata: Metadata = {
  title: { default: "EsportsViewer", template: "%s · EsportsViewer" },
  description: "Your local League of Legends esports library.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ShellHeader preferences={await preferences()} />
        <main id="main-content" className="ev-main" tabIndex={-1}>
          {children}
        </main>
        <ShellFooter />
      </body>
    </html>
  );
}
