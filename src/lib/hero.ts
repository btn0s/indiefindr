/** The big image at the top of a game page: Steam's library hero (key art made to carry the logo over it), else the
 *  first screenshot, else the trailer's poster, else the store header. Cards carry the same choice so they can warm
 *  their game page's hero before the click (src/lib/intent.ts). */
export type HeroFields = { hero?: string | null; hero_poster?: string | null; hero_still?: string | null; header_image: string | null };
export const heroImage = ({ hero, hero_poster, hero_still, header_image }: HeroFields) => hero ?? hero_still ?? hero_poster ?? header_image;

/** The hero's catalog candidates, picked out of the game row by PostgREST. */
export const HERO_FIELDS = "hero_poster:trailers->0->>poster,hero_still:screenshots->>0";

/** How wide the hero renders: the page column (1040px), less the gutters below it. Shared by the page's <Image> and the
 *  warm-up, so both ask for the same file. */
export const HERO_SIZES = "(max-width: 1096px) 100vw, 1040px";
