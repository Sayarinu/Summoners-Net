import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MatchesPage, HistoryPage, DirectoryPage, SearchPage } from "./pages";
import { matchDisplay, localDate, dateTime, identityHref } from "./presentation";
import { Pages, Filters } from "./components";
import { match, game, blue, red, player, page, instant } from "../../../tests/fixtures";
describe("browse presentation", () => {
  it("formats timezone boundaries and incomplete match identities without invented scores", () => {
    expect(localDate("2026-03-01T01:00:00Z", "America/Phoenix")).toBe("02/28/2026");
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
  it("groups matches, hides scores until reveal, and marks stale observations", () => {
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
    expect(screen.getByRole("heading", { name: "Past games" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "02/28/2026" })).toBeVisible();
    expect(screen.getByText("Result hidden")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
    expect(screen.queryByText("Result hidden")).not.toBeInTheDocument();
    expect(screen.getByText("Saved observation · refresh overdue")).toBeVisible();
  });
  it("renders honest empty states, filters and historical table links", () => {
    const view = render(
      <MatchesPage data={page([])} query={{}} hideSpoilers={false} now={instant} />,
    );
    expect(screen.getByText("No matches in this view")).toBeVisible();
    view.rerender(<MatchesPage data={page([])} query={{}} hideSpoilers={false} now={instant} />);
    view.rerender(
      <HistoryPage
        data={page([game, { ...game, id: "partial", patch: null, complete: false }])}
        query={{ year: 2026, league: "LCK" }}
      />,
    );
    expect(screen.getByRole("table", { name: "Historical games" })).toBeVisible();
    expect(screen.getByText("Partial")).toBeVisible();
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
    const watchButtons = screen.getAllByRole("button", { name: "Watch" });
    fireEvent.click(watchButtons[0]!);
    await waitFor(() => expect(screen.getByRole("region", { name: "Watch match" })).toBeVisible());
    expect(watchButtons[0]).toHaveTextContent("Watch");
    expect(screen.queryByRole("heading", { name: "Watch" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Broadcast/ })).toHaveTextContent("Twitch");
    fireEvent.click(screen.getByRole("button", { name: "Load Stream" }));
    expect(document.querySelector("iframe")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unload player" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Player not working" })).not.toBeInTheDocument();
    fireEvent.click(watchButtons[1]!);
    await waitFor(() => {
      expect(screen.getAllByRole("region", { name: "Watch match" })).toHaveLength(1);
      expect(document.querySelector("iframe")).not.toBeInTheDocument();
    });
    fireEvent.click(watchButtons[1]!);
    await waitFor(() =>
      expect(screen.queryByRole("region", { name: "Watch match" })).not.toBeInTheDocument(),
    );
  });
  it("links identities and global results", () => {
    const view = render(
      <DirectoryPage
        kind="team"
        data={page([{ ...blue, imageUrl: "https://example.org/logo.png" }])}
        query={{}}
      />,
    );
    expect(screen.getByRole("link", { name: /Acceptance Blue/ })).toHaveAttribute(
      "href",
      identityHref(blue),
    );
    view.rerender(<DirectoryPage kind="player" data={page([])} query={{ q: "none" }} />);
    expect(screen.getByText("No identities found")).toBeVisible();
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
        ])}
        query={{ q: "Acceptance" }}
      />,
    );
    expect(screen.getAllByRole("article")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /acceptance-game/ })).toHaveAttribute(
      "href",
      `/games/${encodeURIComponent(game.id)}`,
    );
    view.rerender(<SearchPage data={page([])} query={{ q: "none" }} />);
    expect(screen.getByText("No results")).toBeVisible();
    view.rerender(<SearchPage data={page([])} query={{}} />);
    expect(screen.getByRole("heading", { name: "Find a team, player or match" })).toBeVisible();
  });
  it("supports bounded pagination controls", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<Pages data={{ ...page([]), total: 100, pageSize: 25 }} />);
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    error.mockRestore();
  });
});
it("uses linked profile destinations and locally cached search images", () => {
  const image = "/api/images/" + "a".repeat(64);
  const linkedPlayer = { ...player, entityId: "linked" };
  expect(identityHref(linkedPlayer)).toBe("/players/player-blue-mid");
  expect(identityHref({ ...player, publicSlug: undefined })).toBe("/players");
  const view = render(
    <DirectoryPage
      kind="player"
      data={page([{ ...player, sourceCount: 2, imageUrl: image, entityId: "linked" }])}
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
