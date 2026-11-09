import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

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
import { Button } from "./primitives.js";

const baseMatch: MatchDisplay = {
  bestOf: 3,
  competition: "Worlds",
  href: "/match/1",
  id: "m1",
  lifecycle: "scheduled",
  scheduledLabel: "18:00 EDT",
  streamAvailable: true,
  teams: [
    { name: "Gen.G", shortName: "GEN" },
    { name: "T1", shortName: "T1" },
  ],
};

describe("esports identities and schedule", () => {
  it("renders linked and static identities with fallbacks and winner text", () => {
    render(
      <div>
        <TeamIdentity detail="Seed 1" href="/teams/gen" name="Gen.G" shortName="GEN" winner />
        <TeamIdentity name="TBD" shortName="TBD" size="compact" />
        <PlayerIdentity
          country="Korea"
          fullName="Jeong Ji-hoon"
          handle="Chovy"
          href="/players/chovy"
          role="Mid"
        />
        <PlayerIdentity handle="Unknown" />
      </div>,
    );
    expect(screen.getByRole("link", { name: /Gen.G/ })).toHaveTextContent("Winner");
    expect(screen.getByRole("link", { name: /Chovy/ })).toHaveTextContent("Mid");
    expect(screen.getByRole("img", { name: "TBD logo" })).toBeVisible();
  });

  it("renders match lifecycle variations without leaking hidden scores", () => {
    const finalMatch: MatchDisplay = {
      ...baseMatch,
      lifecycle: "final",
      teams: [
        { name: "Gen.G", score: 2, shortName: "GEN", winner: true },
        { name: "T1", score: 1, shortName: "T1" },
      ],
    };
    render(
      <div>
        <MatchRow actions={<Button>Follow</Button>} match={baseMatch} />
        <MatchRow match={{ ...baseMatch, lifecycle: "live" }} />
        <MatchRow match={finalMatch} spoilerHidden />
        <MatchRow match={{ ...baseMatch, lifecycle: "postponed" }} />
        <MatchRow match={{ ...baseMatch, lifecycle: "cancelled" }} />
      </div>,
    );
    expect(screen.getByText("Scheduled")).toBeVisible();
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
    expect(screen.getByText("Postponed")).toBeVisible();
    expect(screen.getByText("Cancelled")).toBeVisible();
    expect(screen.getAllByText("Result hidden")).toHaveLength(1);
  });
});

describe("advanced esports patterns", () => {
  it("renders linked search results", () => {
    render(
      <div>
        <SearchResult
          description="LCK"
          href="/teams/gen"
          meta="Team"
          name="Gen.G"
          shortName="GEN"
          type="team"
        />
      </div>,
    );
    expect(screen.getByRole("link", { name: /Gen.G/ })).toBeVisible();
  });

  it("handles stream consent and embed lifecycle states", async () => {
    const user = userEvent.setup();
    const accept = vi.fn();
    const decline = vi.fn();
    const retry = vi.fn();
    const { rerender } = render(
      <StreamConsent
        onAccept={accept}
        onDecline={decline}
        privacyHref="/privacy"
        provider="Twitch"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Load Stream" }));
    await user.click(screen.getByRole("button", { name: "Not Now" }));
    expect(accept).toHaveBeenCalledOnce();
    expect(decline).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /Privacy details/ })).toHaveAttribute(
      "target",
      "_blank",
    );

    rerender(
      <StreamEmbedShell fallbackHref="/watch" provider="Twitch" title="Live">
        <iframe title="Official stream" />
      </StreamEmbedShell>,
    );
    expect(screen.getByTitle("Official stream")).toBeVisible();
    expect(screen.getByRole("link", { name: /Open on Twitch/ })).toHaveAttribute(
      "rel",
      "noreferrer",
    );
    rerender(
      <StreamEmbedShell mode="replay" provider="YouTube" title="Replay">
        <iframe title="Official replay" />
      </StreamEmbedShell>,
    );
    expect(screen.getByText("Replay")).toBeVisible();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    rerender(
      <StreamEmbedShell
        fallbackHref="/watch"
        onRetry={retry}
        provider="Twitch"
        state="failed"
        title="Failed"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: /Open on Twitch/ })).toBeVisible();
    rerender(<StreamEmbedShell provider="Twitch" state="offline" title="Offline" />);
    expect(screen.getByText("Stream is offline")).toBeVisible();
    rerender(<StreamEmbedShell provider="Twitch" state="loading" title="Loading" />);
    expect(screen.getByText("Loading stream")).toBeVisible();
  });

  it("changes spoiler preference and supports one-time reveal", async () => {
    const user = userEvent.setup();
    const hiddenChange = vi.fn();
    const reveal = vi.fn();
    const { rerender } = render(
      <SpoilerControl hidden onHiddenChange={hiddenChange} onReveal={reveal} />,
    );
    await user.click(screen.getByRole("switch", { name: "Hide results" }));
    await user.click(screen.getByRole("button", { name: "Show Once" }));
    expect(hiddenChange).toHaveBeenCalledWith(false);
    expect(reveal).toHaveBeenCalledOnce();
    rerender(<SpoilerControl hidden={false} onHiddenChange={hiddenChange} />);
    expect(screen.queryByRole("button", { name: "Show Once" })).not.toBeInTheDocument();
  });
});
