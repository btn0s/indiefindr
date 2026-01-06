import { GameDetailSkeleton } from "@/components/skeletons/GameDetailSkeleton";

export default function GamePageLoading() {
  return (
    <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 flex flex-col gap-3 sm:gap-4">
      <GameDetailSkeleton />
    </main>
  );
}
