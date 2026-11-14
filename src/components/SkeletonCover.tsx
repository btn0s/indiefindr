"use client";
import { useParams } from "next/navigation";
import { useSyncExternalStore } from "react";
import { getMorph } from "@/lib/card-morph";

const noSubscription = () => () => {};

/** The loading game page's cover. Opened from a card, it already shows that card's art, the image the card expands
 *  into the cover with (card-morph.ts), so a page still on its way opens the same way as a prefetched one. */
export function SkeletonCover() {
  const { appid } = useParams<{ appid: string }>();
  const art = useSyncExternalStore(noSubscription, () => {
    const morph = getMorph();
    return morph && String(morph.appid) === appid ? morph.art : null;
  }, () => null);
  // eslint-disable-next-line @next/next/no-img-element -- the card's own already-loaded file, so it paints at once
  return <div className="game-trailer">{art && <img src={art} alt="" className="absolute inset-0 size-full object-cover" />}</div>;
}
