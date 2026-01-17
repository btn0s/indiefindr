"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const GameVideo = dynamic(
  () => import("./GameVideo").then((m) => m.GameVideo),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="w-full h-full rounded-lg aspect-video" />
    ),
  }
);

export { GameVideo };
