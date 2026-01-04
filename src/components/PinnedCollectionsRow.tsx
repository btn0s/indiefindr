import { CollectionCard } from "@/components/CollectionCard";

export type PinnedCollectionPreview = {
  id: string;
  title: string;
  description: string | null;
  coverImages: string[];
};

export function PinnedCollectionsRow({
  collections,
  title = "Pinned lists",
}: {
  collections: PinnedCollectionPreview[];
  title?: string;
}) {
  if (collections.length === 0) return null;

  return (
    <section className="w-full px-4">
      <div className="container mx-auto max-w-7xl w-full flex items-center justify-between">
        <h2 className="font-semibold text-xl">{title}</h2>
      </div>
      <div className="container mx-auto max-w-7xl w-full">
        <div className="mt-3 flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {collections.map((c) => (
            <CollectionCard
              key={c.id}
              id={c.id}
              title={c.title}
              description={c.description}
              coverImages={c.coverImages}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

