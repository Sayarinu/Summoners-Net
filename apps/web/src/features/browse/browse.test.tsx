import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchesPage, HistoryPage, DirectoryPage, SearchPage } from "./pages";
import { matchDisplay, localDate, dateTime, identityHref } from "./presentation";
import { Pages, Filters } from "./components";
import { match, game, blue, player, page, instant, status } from "../../../tests/fixtures";
describe("browse presentation", () => {
  it("formats timezone boundaries and incomplete match identities without invented scores", () => {
    expect(localDate("2026-03-01T01:00:00Z", "America/Phoenix")).toBe("2026-02-28");
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
    expect(identityHref(blue)).toContain("/teams/");
    expect(identityHref(player)).toContain("/players/");
  });
  it("groups matches, hides scores until reveal, and exposes source freshness", () => {
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
        source={status.sources[0]}
      />,
    );
    expect(screen.getByRole("heading", { name: "2026-02-28 · LCK" })).toBeVisible();
    expect(screen.getByText("Result hidden")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Reveal score/ }));
    expect(screen.queryByText("Result hidden")).not.toBeInTheDocument();
    expect(screen.getByText("Saved observation · refresh overdue")).toBeVisible();
  });
  it("renders honest empty states, filters and historical table links", () => {
    const view = render(
      <MatchesPage
        data={page([])}
        query={{}}
        hideSpoilers={false}
        now={instant}
        source={status.sources[1]}
      />,
    );
    expect(screen.getByText("No matches in this view")).toBeVisible();
    view.rerender(
      <MatchesPage
        data={page([])}
        query={{}}
        hideSpoilers={false}
        now={instant}
        source={undefined}
      />,
    );
    expect(screen.getByText(/No successful refresh/)).toBeVisible();
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
  });
  it("links identities and global results without collapsing source identities", () => {
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
  expect(identityHref({ ...player, entityId: "linked" })).toBe("/players/linked");
  const view = render(
    <DirectoryPage
      kind="player"
      data={page([{ ...player, sourceCount: 2, imageUrl: image, entityId: "linked" }])}
      query={{}}
    />,
  );
  expect(screen.getByText("Linked Oracle + PandaScore")).toBeVisible();
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
        },
      ])}
    />,
  );
  expect(screen.getByRole("img").querySelector("img")).toHaveAttribute("src", image);
});
