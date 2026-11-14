/** The big image at the top of a game page: the trailer's poster, else the first screenshot, else the store header.
 *  Cards carry the same choice so they can warm their game page's hero before the click (src/lib/intent.ts). */
export type HeroFields = { hero_poster?: string | null; hero_still?: string | null; header_image: string | null };
export const heroImage = ({ hero_poster, hero_still, header_image }: HeroFields) => hero_poster ?? hero_still ?? header_image;

/** The hero's two candidates, picked out of the game row by PostgREST. */
export const HERO_FIELDS = "hero_poster:trailers->0->>poster,hero_still:screenshots->>0";

/** How wide the hero renders. Shared by the page's <Image>, home's feature cards and the warm-up, so all three ask for
 *  the same file. Below 1000px it runs the width of the screen; above, it sits beside the facts (and home's large
 *  feature card is about as wide). */
export const HERO_SIZES = "(max-width: 999px) 100vw, 740px";
