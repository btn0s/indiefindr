export type HeroFields = { hero_poster?: string | null; hero_still?: string | null; header_image: string | null };
export const heroImage = ({ hero_poster, hero_still, header_image }: HeroFields) => hero_still ?? hero_poster ?? header_image;

export const smallCopy = (src: string) => src
  .replace(/(\/ss_[0-9a-f]+)\.jpg/, "$1.600x338.jpg")
  .replace(/(\/[0-9a-f]{40})\/movie_full\.jpg/, "$1/movie_600x337.jpg")
  .replace(/\/movie_full\.jpg/, "/movie.293x165.jpg");

export const HERO_FIELDS = "hero_poster:trailers->0->>poster,hero_still:screenshots->>0";

export const HERO_SIZES = "(max-width: 1175px) 100vw, 1120px";
