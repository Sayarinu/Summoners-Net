"use client";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

/** Returns the in-app path for a plain same-origin link click, or null to let the browser handle it. */
export function softTarget(event: MouseEvent, origin: string): string | null {
  if (event.defaultPrevented || event.button !== 0) return null;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = event.target instanceof Element ? event.target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return null;
  if ((anchor.target && anchor.target !== "_self") || anchor.hasAttribute("download")) return null;
  return appPath(anchor.href, origin, window.location.href);
}

function appPath(href: string, origin: string, current: string): string | null {
  const url = new URL(href, current);
  if (url.origin !== origin || url.pathname.startsWith("/api/")) return null;
  // Same-page fragment links keep native scrolling.
  const here = new URL(current);
  if (url.hash && url.pathname === here.pathname && url.search === here.search) return null;
  return url.pathname + url.search + url.hash;
}

/**
 * Turns every same-origin link, including those rendered by the shared UI package, into a client
 * navigation that keeps the shell mounted. Pages are dynamic, so links are not prefetched.
 */
export function SoftNavigation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const origin = window.location.origin;
    const click = (event: MouseEvent) => {
      const path = softTarget(event, origin);
      if (!path) return;
      event.preventDefault();
      startTransition(() => router.push(path));
    };
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("click", click);
    };
  }, [router]);
  return (
    <div
      aria-hidden="true"
      className={`ev-navigation-progress${pending ? " ev-navigation-progress--active" : ""}`}
    />
  );
}
