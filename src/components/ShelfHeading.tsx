import Link from "next/link";

export function ShelfHeading({ title, note, href }: { title: string; note?: string; href?: string }) {
  return <div className="section-heading">
    <div><h2>{title}</h2>{note && <p>{note}</p>}</div>
    {href && <Link href={href} prefetch={true} className="see-all">See all →</Link>}
  </div>;
}
