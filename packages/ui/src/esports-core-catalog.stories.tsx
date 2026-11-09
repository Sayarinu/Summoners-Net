import type { ReactNode } from "react";
import type { Meta } from "@storybook/react-vite";

import {
  MatchRow,
  PlayerIdentity,
  SearchResult,
  SpoilerControl,
  StreamConsent,
  StreamEmbedShell,
  TeamIdentity,
} from "./esports.js";
import type { MatchDisplay } from "./esports.js";

import "./review.stories.css";

const noop = () => undefined;

const match: MatchDisplay = {
  bestOf: 3,
  classification: "official",
  competition: "Worlds 2026 · Swiss",
  href: "#match",
  id: "match-7F2A",
  lifecycle: "live",
  region: "International",
  scheduledLabel: "Game 2 · 24:18",
  sourceFreshness: "fresh",
  streamAvailable: true,
  streamHref: "#stream",
  teams: [
    { name: "Gen.G", score: 1, shortName: "GEN" },
    { name: "T1", score: 0, shortName: "T1" },
  ],
};

function ReviewStage({
  children,
  width = 900,
}: {
  readonly children: ReactNode;
  readonly width?: number;
}) {
  return (
    <main className="np-review">
      <div className="np-review__inner">
        <div className="np-review__stage" style={{ maxWidth: width }}>
          {children}
        </div>
      </div>
    </main>
  );
}

const meta = {
  parameters: { layout: "fullscreen" },
  title: "Component Inventory/02 V1 Esports Core",
} satisfies Meta;

export default meta;
interface ReviewStory {
  readonly name: string;
  readonly render: () => ReactNode;
}
// Inventory invariant: the first argument names exactly one public rendered export.
const review = (name: string, node: ReactNode, width?: number): ReviewStory => ({
  name,
  render: () => <ReviewStage {...(width === undefined ? {} : { width })}>{node}</ReviewStage>,
});
export const TeamIdentityReview = review(
  "TeamIdentity",
  <TeamIdentity detail="LCK · Seed 1" name="Gen.G" shortName="GEN" />,
);
export const PlayerIdentityReview = review(
  "PlayerIdentity",
  <PlayerIdentity country="Korea" fullName="Jeong Ji-hoon" handle="Chovy" role="Mid" />,
);
export const MatchRowReview = review("MatchRow", <MatchRow match={match} />, 1100);
export const SearchResultReview = review(
  "SearchResult",
  <SearchResult
    description="Mid · Gen.G"
    href="#"
    meta="Player"
    name="Chovy"
    shortName="CHV"
    type="player"
  />,
);
export const StreamConsentReview = review(
  "StreamConsent",
  <StreamConsent onAccept={noop} onDecline={noop} privacyHref="#" provider="Twitch" />,
);
export const StreamEmbedShellReview = review(
  "StreamEmbedShell",
  <StreamEmbedShell provider="Twitch" title="Worlds 2026 official stream">
    <div className="np-review__fake-stream">
      <strong>OFFICIAL LIVE FEED</strong>
      <span>GEN vs T1 · Game 2</span>
    </div>
  </StreamEmbedShell>,
  1100,
);
export const StreamReplayShellReview = review(
  "StreamEmbedShell / Replay",
  <StreamEmbedShell mode="replay" provider="YouTube" title="Worlds 2026 replay">
    <div className="np-review__fake-stream">
      <strong>OFFICIAL REPLAY</strong>
      <span>GEN vs T1 · Game 2</span>
    </div>
  </StreamEmbedShell>,
  1100,
);
export const SpoilerControlReview = review(
  "SpoilerControl",
  <SpoilerControl hidden onHiddenChange={noop} onReveal={noop} />,
);
