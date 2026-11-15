"use client";
import { useId, useRef, type ReactNode } from "react";
import { ShelfHeading } from "./ShelfHeading";
import { CardTracker } from "./CardTracker";
import { RailButtons } from "./RailButtons";

export function Rail({ title, note, href, pageAppid, box = false, children }: {
  title: string; note?: string; href?: string;
  box?: boolean;
  pageAppid?: number;
  children: ReactNode;
}) {
  const row = useRef<HTMLUListElement>(null);
  const id = useId();
  return <section className="rail-section">
    <ShelfHeading title={title} note={note} href={href}>
      <RailButtons rail={row} controls={id} label={title} />
    </ShelfHeading>
    <ul ref={row} id={id} className={box ? "rail box" : "rail"}>{children}</ul>
    <CardTracker pageAppid={pageAppid} />
  </section>;
}
