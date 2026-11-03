import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { SoftNavigation } from "./soft-navigation";
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

function links() {
  document.body.innerHTML = `
    <a id="team" href="/teams/t1?year=2026"><span id="inner">T1</span></a>
    <a id="external" href="https://example.com/teams">Elsewhere</a>
    <a id="image" href="/api/images/abc">Image</a>
    <a id="blank" href="/players" target="_blank">New tab</a>
    <a id="download" href="/history" download>Download</a>
    <a id="fragment" href="#main-content">Skip</a>`;
}
const click = (id: string, init: MouseEventInit = {}) =>
  fireEvent.click(document.getElementById(id)!, { button: 0, ...init });

beforeEach(() => {
  router.push.mockReset();
  window.history.replaceState(null, "", "/teams");
});

it("turns plain in-app link clicks into client navigations", () => {
  const view = render(<SoftNavigation />);
  links();
  expect(click("inner")).toBe(false);
  expect(router.push).toHaveBeenCalledWith("/teams/t1?year=2026");
  view.unmount();
});

it("leaves modified clicks, new tabs, downloads, API, external and fragment links to the browser", () => {
  const view = render(<SoftNavigation />);
  links();
  for (const [id, init] of [
    ["team", { metaKey: true }],
    ["team", { ctrlKey: true }],
    ["team", { button: 1 }],
    ["external", {}],
    ["image", {}],
    ["blank", {}],
    ["download", {}],
    ["fragment", {}],
  ] as const)
    click(id, init);
  expect(router.push).not.toHaveBeenCalled();
  document.getElementById("team")!.addEventListener("click", (event) => event.preventDefault(), {
    once: true,
  });
  click("team");
  expect(router.push).not.toHaveBeenCalled();
  view.unmount();
});

it("shows navigation progress and stops intercepting once unmounted", () => {
  const view = render(<SoftNavigation />);
  links();
  expect(view.container.firstElementChild).toHaveClass("ev-navigation-progress");
  view.unmount();
  click("team");
  expect(router.push).not.toHaveBeenCalled();
});
