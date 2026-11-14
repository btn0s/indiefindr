/** The big image at the top of a game page, the still under its gameplay clip: the first screenshot (gameplay, where a
 *  trailer's poster is often a title card), else the trailer's poster, else the store header. Cards carry the same
 *  choice so they can warm their game page's hero before the click (src/lib/intent.ts). */
export type HeroFields = { hero_poster?: string | null; hero_still?: string | null; header_image: string | null };
export const heroImage = ({ hero_poster, hero_still, header_image }: HeroFields) => hero_still ?? hero_poster ?? header_image;

/** Steam's own smaller copy of a store image: the same picture, served ready-made. A screenshot comes at 600×338 and a
 *  trailer poster at 600×337, except older trailers (no hash folder in the path), which only have 293×165. A store
 *  header is already small, so it is its own copy. */
export const smallCopy = (src: string) => src
  .replace(/(\/ss_[0-9a-f]+)\.jpg/, "$1.600x338.jpg")
  .replace(/(\/[0-9a-f]{40})\/movie_full\.jpg/, "$1/movie_600x337.jpg")
  .replace(/\/movie_full\.jpg/, "/movie.293x165.jpg");

/** The hero's two candidates, picked out of the game row by PostgREST. */
export const HERO_FIELDS = "hero_poster:trailers->0->>poster,hero_still:screenshots->>0";

/** How wide the hero renders. Shared by the page's <Image> and the warm-up, so both ask for the same file. Below 1000px
 *  it runs the width of the screen; above, it sits beside the facts. */
export const HERO_SIZES = "(max-width: 999px) 100vw, 640px";
