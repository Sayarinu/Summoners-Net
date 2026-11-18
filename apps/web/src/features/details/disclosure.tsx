"use client";
import { useState, type ReactNode } from "react";

export function Disclosure({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className={className ? `ev-disclosure ${className}` : "ev-disclosure"}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{title}</summary>
      {open ? <div className="ev-disclosure__body">{children}</div> : null}
    </details>
  );
}
