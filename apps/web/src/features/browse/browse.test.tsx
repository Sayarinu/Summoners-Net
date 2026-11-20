import { describe, it, expect, vi, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchesPage, PastMatchesPage, SearchPage } from "./pages";
import { PlayerFinder } from "./players";
import { matchDisplay, dateTime, identityHref } from "./presentation";
import { Pages, Filters } from "./components";
import { useRouter } from "next/navigation";
import { match, game, blue, red, player, page, instant } from "../../../tests/fixtures";
describe("browse presentation", () => {
  it("formats timezone boundaries and incomplete match identities without invented scores", () => {
    expect(dateTime("2026-03-01T01:00:00Z", "America/Phoenix")).toMatch(/^02\/28\/2026/);
    expect(dateTime(null, "UTC")).toBe("Time to be confirmed");
    expect(
      matchDisplay({ ...match, teams: [], state: "live" }, "UTC", "2026-03-02T00:00:00Z"),
    ).toMatchObject({
      sourceFreshness: "stale",
      teams: [{ shortName: "TBD" }, { shortName: "TBD" }],
    });
    expect(
      matchDisplay(
        {
          ...match,
          teams: [{ ...blue, imageUrl: "https://example.org/logo.png", score: null }],
        },
        "UTC",
        instant,
      ).teams[0],
    ).toEqual({
      name: blue.name,
      shortName: blue.name,
      logo: "https://example.org/logo.png",
    });
    expect(
      matchDisplay(
        { ...match, state: "scheduled", teams: match.teams.map((team) => ({ ...team, score: 0 })) },
        "UTC",
        instant,
      ).teams,
    ).toEqual([
      { name: blue.name, shortName: blue.name },
      { name: red.name, shortName: red.name },
    ]);
    expect(matchDisplay({ ...match, teams: [] }, "UTC", instant).teams).toEqual([
      { name: "TBD", shortName: "TBD" },
      { name: "TBD", shortName: "TBD" },
    ]);
    expect(identityHref(blue)).toContain("/teams/");
    expect(identityHref(player)).toContain("/players/");
  });
  it("lists matches in flat rows by state, hides scores until reveal, and omits stale observations", () => {
    render(
      <MatchesPage
        data={page([
          match,
          {
            ...match,
            id: "two",
            startsAt: null,
            state: "live",
            updatedAt: "2026-01-01T00:00:00Z",
          },
        ])}
        query={{ timezone: "America/Phoenix" }}
        hideSpoilers
        now={instant}
      />,
    );
    expect(screen.getByRole("heading", { name: "Past Games" })).toBeVisible();
    // Rows carry their own date; there are no per-day group headings.
    expect(screen.queryByRole("heading", { name: "02/28/2026" })).not.toBeInTheDocument();
    expect(screen.getByText(/^02\/28\/2026/)).toBeVisible();
    expect(screen.getByText("Result Hidden")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
    expect(screen.queryByText("Result Hidden")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved observation · refresh overdue")).not.toBeInTheDocument();
  });
  it("lists past series as overview rows grouped by month, newest first", () => {
    const later = {
      ...match,
      id: "pandascore:match:2",
      startsAt: "2026-04-02T01:00:00.000Z",
      broadcasts: [],
    };
    const view = render(
      <PastMatchesPage
        view="series"
        series={page([later, match, { ...match, id: "pandascore:match:3", startsAt: null }])}
        query={{ timezone: "UTC", league: "LCK" }}
        hideSpoilers
        now={instant}
      />,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Past Matches" })).toBeVisible();
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(["April 2026", "March 2026", "Date to Be Confirmed"]);
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByLabelText("Filter Matches")).toBeVisible();
    expect(screen.getByRole("link", { name: "Series" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "href",
      "/history?league=LCK&view=games",
    );
    expect(screen.getAllByText("Result Hidden")).toHaveLength(3);
    fireEvent.click(screen.getAllByRole("button", { name: /Reveal score/ })[0]!);
    expect(screen.getAllByText("Result Hidden")).toHaveLength(2);
    // Only one stream opens at a time across every month.
    fireEvent.click(screen.getAllByRole("button", { name: "Watch Replay" })[0]!);
    expect(screen.getAllByRole("button", { name: "Close Stream" })).toHaveLength(1);
    view.rerender(
      <PastMatchesPage
        view="series"
        series={page([])}
        query={{}}
        hideSpoilers={false}
        now={instant}
      />,
    );
    expect(screen.getByText("No Past Matches in This View")).toBeVisible();
  });
  it("renders honest empty states, filters and historical table links", () => {
    const view = render(
      <MatchesPage data={page([])} query={{}} hideSpoilers={false} now={instant} />,
    );
    expect(screen.getByText("No Matches in This View")).toBeVisible();
    view.rerender(<MatchesPage data={page([])} query={{}} hideSpoilers={false} now={instant} />);
    view.rerender(
      <PastMatchesPage
        view="games"
        games={page([game, { ...game, id: "partial", patch: null, complete: false }])}
        query={{ year: 2026, league: "LCK" }}
        hideSpoilers={false}
        now={instant}
      />,
    );
    expect(screen.getByLabelText("Filter Games")).toBeVisible();
    expect(new FormData(screen.getByLabelText<HTMLInputElement>("Year").form!).get("view")).toBe(
      "games",
    );
    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Series" })).toHaveAttribute(
      "href",
      "/history?league=LCK&year=2026",
    );
    expect(screen.getByRole("table", { name: "Historical Games" })).toBeVisible();
    expect(screen.queryByRole("columnheader", { name: "Statistics" })).toBeNull();
    expect(screen.getByLabelText("Year")).toHaveValue(2026);
    view.rerender(<Filters query={{ state: "final", date: "2026-03-01", q: "Blue" }} />);
    expect(screen.getByLabelText("Date")).toHaveValue("2026-03-01");
    expect(new FormData(screen.getByLabelText<HTMLInputElement>("Date").form!).get("date")).toBe(
      "2026-03-01",
    );
    view.unmount();
    render(<Filters query={{ timezone: "UTC" }} />);
    expect(screen.getByLabelText("Date")).toHaveValue(new Date().toISOString().slice(0, 10));
    expect(new FormData(screen.getByLabelText<HTMLInputElement>("Date").form!).has("date")).toBe(
      false,
    );
  });
  it("shows both sides around vs and marks the game winner only when scores are visible", () => {
    const props = { view: "games" as const, games: page([game]), query: {}, now: instant };
    const view = render(<PastMatchesPage {...props} hideSpoilers />);
    expect(screen.getByText("vs", { exact: true })).toBeVisible();
    expect(screen.queryByText("Winner")).toBeNull();
    view.rerender(<PastMatchesPage {...props} hideSpoilers={false} />);
    const winner = screen.getByText("Winner");
    expect(winner.closest("a")).toHaveTextContent(blue.name);
    expect(winner.closest("a")).toHaveAttribute("data-side", "blue");
  });
  it("labels the broadcast action Watch Live only while a match is live", () => {
    render(
      <MatchesPage
        data={page([{ ...match, state: "live" }])}
        query={{ timezone: "UTC" }}
        hideSpoilers={false}
        now={instant}
      />,
    );
    expect(screen.getByRole("button", { name: "Watch Live" })).toHaveTextContent("Watch Live");
  });
  it("mounts only one inline broadcast row and stops its player when collapsed", async () => {
    render(
      <MatchesPage
        data={page([match, { ...match, id: "second-match" }])}
        query={{ timezone: "UTC" }}
        hideSpoilers={false}
        now={instant}
      />,
    );
    expect(screen.queryByRole("heading", { name: "Watch" })).not.toBeInTheDocument();
    const watchButtons = screen.getAllByRole("button", { name: "Watch Replay" });
    fireEvent.click(watchButtons[0]!);
    await waitFor(() => expect(screen.getByRole("region", { name: "Watch Match" })).toBeVisible());
    expect(watchButtons[0]).toHaveTextContent("Watch Replay");
    expect(screen.queryByRole("heading", { name: "Watch" })).not.toBeInTheDocument();
    // Finished matches open their YouTube recording; the live Twitch channel is not offered.
    expect(screen.getByRole("button", { name: /Broadcast/ })).toHaveTextContent("YouTube");
    expect(screen.queryByRole("button", { name: "Load Stream" })).not.toBeInTheDocument();
    expect(document.querySelector("iframe")).toHaveAttribute(
      "src",
      expect.stringContaining("autoplay=0"),
    );
    expect(screen.queryByRole("button", { name: "Unload Player" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Player Not Working" })).not.toBeInTheDocument();
    fireEvent.click(watchButtons[1]!);
    await waitFor(() => {
      expect(screen.getAllByRole("region", { name: "Watch Match" })).toHaveLength(1);
      expect(document.querySelectorAll("iframe")).toHaveLength(1);
    });
    fireEvent.click(watchButtons[1]!);
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Watch Match" })).not.toBeInTheDocument(),
    );
    expect(document.querySelector("iframe")).not.toBeInTheDocument();
  });
  it("opens live matches on Twitch and hides Watch when a finished match has no recording", async () => {
    render(
      <MatchesPage
        data={page([
          { ...match, id: "live-match", state: "live", updatedAt: instant },
          { ...match, id: "channel-only", broadcasts: match.broadcasts.slice(1) },
        ])}
        query={{ timezone: "UTC" }}
        hideSpoilers={false}
        now={instant}
      />,
    );
    const watch = screen.getAllByRole("button", { name: /^Watch/ });
    expect(watch).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /Watch Live/ })).not.toBeInTheDocument();
    fireEvent.click(watch[0]!);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Broadcast/ })).toHaveTextContent("Twitch"),
    );
    expect(document.querySelector("iframe")).toHaveAttribute(
      "src",
      expect.stringContaining("autoplay=false"),
    );
  });
  it("links identities and global results", async () => {
    const view = render(
      <PlayerFinder
        data={{
          ...page([
            { ...player, team: { ...blue, imageUrl: "https://example.org/logo.png" } },
            { ...player, id: "free", name: "Free Agent", publicSlug: "free-agent", team: null },
          ]),
          pageSize: 36,
        }}
        query={{ q: "Player", league: "LCK" }}
      />,
    );
    const card = screen.getByRole("link", { name: /Player Blue mid/ }).closest("li")!;
    expect(screen.getByRole("link", { name: /Player Blue mid/ })).toHaveAttribute(
      "href",
      identityHref(player),
    );
    expect(card.querySelector('[aria-label="Mid"]')).not.toBeNull();
    expect(screen.getByRole("link", { name: /Acceptance Blue/ })).toHaveAttribute(
      "href",
      identityHref(blue),
    );
    expect(screen.getByRole("img", { name: "Acceptance Blue logo" })).toBeVisible();
    expect(screen.getByText("No current team")).toBeVisible();
    expect(screen.getByRole("searchbox", { name: "Search Players" })).toHaveValue("Player");
    expect(screen.getByRole("button", { name: /League/ })).toHaveTextContent("LCK");
    expect(document.querySelector('input[name="pageSize"]')).toHaveValue("36");
    const { replace } = useRouter() as unknown as Record<"replace", Mock>;
    replace.mockClear();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search Players" }), {
      target: { value: "Faker" },
    });
    await waitFor(() => expect(replace).toHaveBeenCalledTimes(1));
    expect(replace.mock.calls[0]).toEqual(["/?q=Faker&league=LCK&pageSize=36", { scroll: false }]);
    view.rerender(<PlayerFinder data={page([])} query={{ q: "none" }} />);
    expect(screen.getByText("No Players Found")).toBeVisible();
    view.rerender(
      <SearchPage
        data={page([
          {
            id: player.id,
            kind: "player",
            name: player.name,
            detail: "oracle",
          },
          { id: match.id, kind: "match", name: match.name, detail: "LCK" },
          { id: game.id, kind: "game", name: game.sourceId, detail: "2026" },
          { id: "Ahri", kind: "champion", name: "Ahri", detail: "Champion" },
          { id: "puuid/1", kind: "summoner", name: "Mid Ahri#EUW", detail: "Solo queue player" },
        ])}
        query={{ q: "Acceptance" }}
      />,
    );
    expect(screen.getByRole("link", { name: "Ahri" })).toHaveAttribute("href", "/champions/Ahri");
    expect(screen.getByRole("link", { name: /Mid Ahri#EUW/ })).toHaveAttribute(
      "href",
      "/summoners/puuid%2F1",
    );
    expect(screen.getByRole("link", { name: /acceptance-game/ })).toHaveAttribute(
      "href",
      `/games/${encodeURIComponent(game.id)}`,
    );
    view.rerender(<SearchPage data={page([])} query={{ q: "none" }} />);
    expect(screen.getByText("No Results")).toBeVisible();
    view.rerender(<SearchPage data={page([])} query={{}} />);
    expect(screen.getByRole("heading", { name: "Find a Team, Player or Match" })).toBeVisible();
  });
  it("supports bounded pagination controls", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Pages data={{ ...page([]), total: 100, pageSize: 25 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Next Page" }));
    expect(screen.getByRole("button", { name: "Previous Page" })).toBeDisabled();
    error.mockRestore();
  });
});
it("uses linked profile destinations and locally cached search images", () => {
  const image = "/api/images/" + "a".repeat(64);
  const linkedPlayer = { ...player, entityId: "linked" };
  expect(identityHref(linkedPlayer)).toBe("/players/player-blue-mid");
  expect(identityHref({ ...player, publicSlug: undefined })).toBe("/players");
  const view = render(
    <PlayerFinder
      data={page([{ ...player, sourceCount: 2, imageUrl: image, entityId: "linked", team: null }])}
      query={{}}
    />,
  );
  expect(screen.queryByText("Linked Oracle + PandaScore")).toBeNull();
  view.rerender(
    <SearchPage
      query={{ q: player.name }}
      data={page([
        {
          id: "linked",
          kind: "player",
          name: player.name,
          detail: "Linked sources",
          imageUrl: image,
          publicSlug: "player-blue-mid",
        },
      ])}
    />,
  );
  expect(screen.getByRole("img").querySelector("img")).toHaveAttribute("src", image);
});

it("filters in place once typing pauses, keeping the field and everything typed", () => {
  vi.useFakeTimers();
  try {
    const { replace } = useRouter() as unknown as Record<"replace", Mock>;
    replace.mockClear();
    render(<Filters query={{ timezone: "UTC", league: "LCK" }} history view="games" />);
    const field = screen.getByLabelText<HTMLInputElement>("Filter Games");
    field.focus();
    fireEvent.change(field, { target: { value: "Gen" } });
    vi.advanceTimersByTime(200);
    fireEvent.change(field, { target: { value: "Gen.G" } });
    vi.advanceTimersByTime(200);
    expect(replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(replace).toHaveBeenCalledTimes(1);
    const [url, options] = replace.mock.calls[0] as [string, object];
    const params = new URL(url, "http://localhost").searchParams;
    expect(params.get("view")).toBe("games");
    expect(params.get("q")).toBe("Gen.G");
    expect(params.get("league")).toBe("LCK");
    expect(options).toEqual({ scroll: false });
    expect(field).toHaveFocus();
    expect(field).toHaveValue("Gen.G");
  } finally {
    vi.useRealTimers();
  }
});
