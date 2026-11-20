import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const replace = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/players",
}));
import { FillingGrid, pageForSize, wholeRowPageSize } from "./page-fill";

/** Lays the grid out as a browser would: columns and rows of fixed tracks below a toolbar. */
function layout({ columns, top, height }: { columns: number; top: number; height: number }) {
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(height);
  vi.spyOn(window, "innerWidth", "get").mockReturnValue(columns * 300 + height);
  vi.spyOn(window, "getComputedStyle").mockReturnValue({
    gridTemplateColumns: Array.from({ length: columns }, () => "280px").join(" "),
    gridTemplateRows: "88px 92px",
    rowGap: "12px",
  } as CSSStyleDeclaration);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const grid = this.tagName === "UL";
    return { top: grid ? top : top + 192, bottom: grid ? top + 192 : top + 240 } as DOMRect;
  });
}

function grid(props: { page: number; pageSize: number; total: number }) {
  return (
    <div>
      <FillingGrid className="grid" label="Players" {...props}>
        <li>One</li>
        <li>Two</li>
      </FillingGrid>
      <nav>Pages</nav>
    </div>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  replace.mockReset();
});

describe("directory page sizing", () => {
  it("fills the visible height with whole rows within the directory bounds", () => {
    expect(wholeRowPageSize({ available: 752, rowHeight: 92, rowGap: 12, columns: 3 })).toBe(21);
    expect(wholeRowPageSize({ available: 40, rowHeight: 92, rowGap: 12, columns: 4 })).toBe(8);
    expect(wholeRowPageSize({ available: 9000, rowHeight: 50, rowGap: 0, columns: 7 })).toBe(119);
    expect(wholeRowPageSize({ available: 500, rowHeight: 0, rowGap: 0, columns: 0 })).toBe(6);
    expect(pageForSize(3, 25, 24)).toBe(3);
    expect(pageForSize(2, 24, 48)).toBe(1);
  });

  it("replaces the page size and keeps the first card on the page after the grid measures", () => {
    window.history.replaceState(null, "", "/players?league=LCK&page=3&pageSize=25");
    layout({ columns: 3, top: 200, height: 1000 });
    render(grid({ page: 3, pageSize: 25, total: 400 }));
    // 1000px viewport, grid at 200px and 48px of pagination below: 7 rows of 3 cards.
    expect(replace).toHaveBeenCalledExactlyOnceWith("/players?league=LCK&page=3&pageSize=21", {
      scroll: false,
    });
  });

  it("settles once sized and only measures again after the viewport is resized", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/players");
    layout({ columns: 4, top: 200, height: 1000 });
    const view = render(grid({ page: 1, pageSize: 24, total: 400 }));
    expect(replace).toHaveBeenCalledExactlyOnceWith("/players?pageSize=28", { scroll: false });
    // The sized page renders with rows of another height; it is not resized in a loop.
    view.rerender(grid({ page: 1, pageSize: 28, total: 400 }));
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      gridTemplateColumns: "280px 280px 280px 280px",
      gridTemplateRows: "200px",
      rowGap: "12px",
    } as CSSStyleDeclaration);
    view.rerender(grid({ page: 2, pageSize: 28, total: 400 }));
    expect(replace).toHaveBeenCalledOnce();
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(1400);
    window.dispatchEvent(new Event("resize"));
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(200);
    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenLastCalledWith("/players?pageSize=20&page=2", { scroll: false });
  });

  it("leaves pages that already hold every record and other routes alone", () => {
    window.history.replaceState(null, "", "/players");
    layout({ columns: 2, top: 100, height: 700 });
    render(grid({ page: 1, pageSize: 24, total: 2 }));
    window.history.replaceState(null, "", "/teams");
    render(grid({ page: 1, pageSize: 24, total: 400 }));
    expect(replace).not.toHaveBeenCalled();
  });
});
