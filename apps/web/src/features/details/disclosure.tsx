"use client";
import { useState, type ReactNode } from "react";

export function Disclosure({
  title,
  children,
  initiallyOpen = false,
}: {
  title: string;
  children: ReactNode;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <details
      className="ev-disclosure"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {open ? <div className="ev-disclosure__body">{children}</div> : null}
    </details>
  );
}
