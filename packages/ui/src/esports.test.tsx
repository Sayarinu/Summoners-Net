import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  BracketShell,
  ChampionPick,
  CompetitionIdentity,
  DateRail,
  EntityDirectoryIntro,
  EventHeader,
  FilterBar,
  MatchCard,
  MatchRow,
  PickBan,
  PlayerIdentity,
  RosterRow,
  ScheduleGroup,
  SearchResult,
  SpoilerControl,
  StandingsTable,
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
        <CompetitionIdentity
          href="/events/lck"
          name="LCK"
          region="Korea"
          shortName="LCK"
          tier="Tier 1"
        />
        <CompetitionIdentity name="Worlds" shortName="W" />
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
    expect(screen.getByRole("link", { name: /LCK/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /Gen.G/ })).toHaveTextContent("Winner");
    expect(screen.getByRole("link", { name: /Chovy/ })).toHaveTextContent("Mid");
    expect(screen.getByRole("img", { name: "TBD logo" })).toBeVisible();
  });

  it("renders roster rows and match lifecycle variations without leaking hidden scores", () => {
    const finalMatch: MatchDisplay = {
      ...baseMatch,
      lifecycle: "final",
      teams: [
        { name: "Gen.G", score: 2, shortName: "GEN", winner: true },
        { name: "T1", score: 1, shortName: "T1" },
      ],
    };
    const { container } = render(
      <div>
        <RosterRow
          actions={<Button>Open</Button>}
          detail="Starter detail"
          player={{ handle: "Chovy", role: "Mid" }}
        />
        <RosterRow player={{ handle: "Active player" }} status="active" />
        <RosterRow player={{ handle: "Coach" }} status="coach" />
        <RosterRow player={{ handle: "Inactive" }} status="inactive" />
        <MatchRow actions={<Button>Follow</Button>} match={baseMatch} />
        <MatchRow match={{ ...baseMatch, lifecycle: "live" }} />
        <MatchRow match={finalMatch} spoilerHidden />
        <MatchRow match={{ ...baseMatch, lifecycle: "postponed" }} />
        <MatchRow match={{ ...baseMatch, lifecycle: "cancelled" }} />
        <MatchCard match={finalMatch} spoilerHidden />
      </div>,
    );
    expect(screen.getByText("Starter detail")).toBeVisible();
    expect(screen.getByText("active")).toHaveClass("np-status--success");
    expect(screen.getByText("Scheduled")).toBeVisible();
    expect(screen.getAllByText("Live").length).toBeGreaterThan(0);
    expect(screen.getByText("Postponed")).toBeVisible();
    expect(screen.getByText("Cancelled")).toBeVisible();
    expect(screen.getAllByText("Result hidden")).toHaveLength(2);
    const hiddenCard = container.querySelector(".np-match-card__cover")?.parentElement;
    expect(hiddenCard).not.toHaveTextContent("2");
  });

  it("supports date selection and schedule/event compositions", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onNext = vi.fn();
    const onPrevious = vi.fn();
    const { rerender } = render(
      <div>
        <DateRail
          items={[
            { count: 2, day: "Fri", id: "10", label: "Jul 10", today: true },
            { day: "Sat", disabled: false, id: "11", label: "Jul 11" },
          ]}
          onChange={onChange}
          onNext={onNext}
          onPrevious={onPrevious}
          selectedId="10"
        />
        <ScheduleGroup count={1} dateLabel="Today" description="Local time" stale>
          <MatchRow match={baseMatch} />
        </ScheduleGroup>
        <EventHeader
          actions={<Button>Official</Button>}
          dates="Sep — Nov"
          format="Swiss"
          name="Worlds"
          region="International"
          shortName="W"
          status="live"
          tier="Tier 1"
        />
        <EventHeader dates="Complete" name="MSI" shortName="MSI" status="completed" />
      </div>,
    );
    await user.click(screen.getByRole("button", { name: /Sat/ }));
    await user.click(screen.getByRole("button", { name: "Next dates" }));
    await user.click(screen.getByRole("button", { name: "Previous dates" }));
    expect(onChange).toHaveBeenCalledWith("11");
    expect(onNext).toHaveBeenCalledOnce();
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Today" })).toBeVisible();
    expect(screen.getByText("Completed")).toBeVisible();
    expect(screen.getAllByRole("heading", { name: "Worlds" })).toHaveLength(1);
    expect(screen.getByText("International · Tier 1")).toBeVisible();

    rerender(
      <DateRail
        items={[{ day: "Fri", id: "10", label: "Jul 10", today: true }]}
        onChange={onChange}
        selectedId="10"
      />,
    );
    expect(screen.queryByRole("button", { name: "Next dates" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous dates" })).not.toBeInTheDocument();
  });

  it("renders standings with and without point columns", () => {
    const { rerender } = render(
      <StandingsTable
        caption="Standings"
        rows={[
          {
            id: "gen",
            losses: 0,
            points: 9,
            position: 1,
            qualified: true,
            team: { name: "Gen.G", shortName: "GEN" },
            wins: 3,
          },
          {
            form: "W L",
            id: "t1",
            losses: 1,
            position: 2,
            team: { name: "T1", shortName: "T1" },
            wins: 2,
          },
        ]}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "PTS" })).toBeVisible();
    expect(screen.getByText("Qualified")).toBeVisible();
    rerender(
      <StandingsTable
        caption="No points"
        rows={[
          { id: "gen", losses: 0, position: 1, team: { name: "Gen.G", shortName: "GEN" }, wins: 3 },
        ]}
      />,
    );
    expect(screen.queryByRole("columnheader", { name: "PTS" })).not.toBeInTheDocument();
  });
});

describe("advanced esports patterns", () => {
  it("renders bracket rounds, selects matches, and handles empty state", async () => {
    const user = userEvent.setup();
    const onMatch = vi.fn();
    const onRound = vi.fn();
    const { rerender } = render(
      <BracketShell
        activeRound="semi"
        onMatchSelect={onMatch}
        onRoundSelect={onRound}
        rounds={[
          {
            id: "semi",
            label: "Semifinal",
            matches: [
              {
                id: "b1",
                lifecycle: "live",
                teams: [
                  { name: "Gen.G", score: 1, shortName: "GEN", winner: true },
                  { name: "T1", score: 0, shortName: "T1" },
                ],
              },
            ],
          },
          { id: "final", label: "Final", matches: [] },
        ]}
        title="Knockout"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Final" }));
    await user.click(screen.getByRole("button", { name: /Gen.G/ }));
    expect(onRound).toHaveBeenCalledWith("final");
    expect(onMatch).toHaveBeenCalledWith("b1");
    rerender(<BracketShell rounds={[]} title="Empty bracket" />);
    expect(screen.getByText("Bracket is not available yet")).toBeVisible();
  });

  it("renders champion picks and all pick-ban availability states", () => {
    const sides = [
      {
        bans: [{ champion: "Rumble" }],
        name: "Blue",
        picks: [{ champion: "Azir", order: 1, player: "Chovy" }],
      },
      {
        bans: [{ champion: "Vi" }],
        name: "Red",
        picks: [{ action: "placeholder" as const, champion: "Pending" }],
      },
    ] as const;
    const { rerender } = render(
      <div>
        <ChampionPick action="ban" champion="Rumble" order={2} side="red" />
        <PickBan gameLabel="Game 1" sides={sides} status="stale" />
      </div>,
    );
    expect(screen.getByLabelText("Ban 2: Rumble")).toBeVisible();
    expect(screen.getByText("Stale")).toBeVisible();
    rerender(<PickBan gameLabel="Game 2" sides={sides} spoilerHidden />);
    expect(screen.getByText("Game 2 draft hidden")).toBeVisible();
    rerender(<PickBan gameLabel="Game 3" sides={sides} status="unavailable" />);
    expect(screen.getByText("Pick and ban unavailable")).toBeVisible();
  });

  it("supports search/filter interactions and directory composition", async () => {
    const user = userEvent.setup();
    const remove = vi.fn();
    const clear = vi.fn();
    const open = vi.fn();
    const { container } = render(
      <div>
        <EntityDirectoryIntro>Search tools</EntityDirectoryIntro>
        <SearchResult
          description="LCK"
          href="/teams/gen"
          meta="Team"
          name="Gen.G"
          shortName="GEN"
          type="team"
        />
        <FilterBar
          applied={[
            { id: "tier", label: "Tier 1" },
            { id: "region", label: "LCK" },
          ]}
          onClearAll={clear}
          onOpenFilters={open}
          onRemove={remove}
          resultCount={24}
        >
          Tools
        </FilterBar>
      </div>,
    );
    expect(screen.getByRole("link", { name: /Gen.G/ })).toBeVisible();
    expect(container.querySelector(".np-directory-intro__visual")).not.toBeInTheDocument();
    expect(screen.getByText("24 results")).toHaveAttribute("aria-live", "polite");
    await user.click(screen.getByRole("button", { name: /Filters/ }));
    await user.click(screen.getByRole("button", { name: "Remove LCK filter" }));
    await user.click(screen.getByRole("button", { name: "Clear All" }));
    expect(open).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("region");
    expect(clear).toHaveBeenCalledOnce();
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
