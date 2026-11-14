"use client";
import { useId, useRef, type ReactNode } from "react";
import { ShelfHeading } from "./ShelfHeading";
import { CardTracker } from "./CardTracker";
import { RailButtons } from "./RailButtons";

/** A shelf as one horizontal row of cards: the heading (title, note, See all) with Previous and Next beside it, then
 *  the row, which scrolls and snaps on its own. On phones and tablets it runs to the screen edges with the next card
 *  peeking in. The cards render on the server and arrive as children, one <li> each; one tracker covers the row. */
export function Rail({ title, note, href, pageAppid, children }: {
  title: string; note?: string; href?: string;
  /** The game page the rail sits on, for tracking. */
  pageAppid?: number;
  children: ReactNode;
}) {
  const row = useRef<HTMLUListElement>(null);
  const id = useId();
  return <section className="rail-section">
    <ShelfHeading title={title} note={note} href={href}>
      <RailButtons rail={row} controls={id} label={title} />
    </ShelfHeading>
    <ul ref={row} id={id} className="rail">{children}</ul>
    <CardTracker pageAppid={pageAppid} />
  </section>;
}
