import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());

class ResizeObserverMock implements ResizeObserver {
  disconnect() {}
  observe() {}
  unobserve() {}
}

Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  value: ResizeObserverMock,
});

Object.defineProperty(globalThis, "PointerEvent", {
  configurable: true,
  value: MouseEvent,
});

Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
});

if (typeof CSS.escape !== "function") {
  Object.defineProperty(CSS, "escape", {
    configurable: true,
    value: (value: string) => value.replaceAll(/[^a-zA-Z0-9_-]/g, "_"),
  });
}
