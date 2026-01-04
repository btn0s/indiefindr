import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type CollectionCardProps = {
  id: string;
  title: string;
  description?: string | null;
  coverImages?: string[];
};

export function CollectionCard({
  id,
  title,
  description,
  coverImages = [],
}: CollectionCardProps) {
  const covers = coverImages.filter(Boolean).slice(0, 4);
  const tiles = [covers[0], covers[1], covers[2], covers[3]];

  return (
    <Link
      href={`/collections/${id}`}
      className="block snap-start min-w-[260px] max-w-[260px]"
    >
      <Card
        size="sm"
        className="gap-0 py-0 overflow-hidden transition-colors hover:bg-muted/30"
      >
        <div className="grid grid-cols-2 grid-rows-2 gap-px bg-muted aspect-video">
          {covers.length === 0 ? (
            <div className="col-span-2 row-span-2 flex items-center justify-center text-xs text-muted-foreground">
              Empty collection
            </div>
          ) : (
            tiles.map((src, idx) => (
              <div key={idx} className="relative">
                {src ? (
                  <Image
                    src={src}
                    alt={title}
                    fill
                    sizes="260px"
                    className="object-cover"
                  />
                ) : null}
              </div>
            ))
          )}
        </div>

        <CardHeader className="pb-0">
          <CardTitle className="line-clamp-1">{title}</CardTitle>
          {description ? (
            <CardDescription className="line-clamp-2">
              {description}
            </CardDescription>
          ) : null}
        </CardHeader>

        {/* Keep spacing consistent even without description */}
        <CardContent className="pt-2" />
      </Card>
    </Link>
  );
}

