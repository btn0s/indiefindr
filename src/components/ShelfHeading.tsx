import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

/** Title over a one-line note; See all and any controls (a rail's Previous and Next) on the right. */
export function ShelfHeading({ title, note, href, children }: { title: string; note?: string; href?: string; children?: ReactNode }) {
  return <div className="section-heading">
    <div><h2>{title}</h2>{note && <p>{note}</p>}</div>
    {(href || children) && <div className="section-actions">
      {href && <Link href={href} prefetch={true} className="see-all">See all<ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>}
      {children}
    </div>}
  </div>;
}
