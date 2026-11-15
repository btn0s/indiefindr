import { SwordMark } from "./SwordMark";

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="empty-note"><SwordMark /><p>{children}</p></div>;
}
