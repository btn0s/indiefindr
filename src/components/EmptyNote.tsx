import { SwordMark } from "./SwordMark";

/** A missing list, shown as a quiet tray with the sword so it reads as a place rather than a gap. */
export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="empty-note"><SwordMark /><p>{children}</p></div>;
}
