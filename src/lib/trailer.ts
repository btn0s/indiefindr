/** A Steam trailer as the catalog stores it: its HLS stream (with sound) and its poster. */
export type Trailer = { title: string; url: string; poster: string | null };

/** The trailer a game is shown by: the first whose title says it's gameplay, else the first. */
export function pickTrailer(trailers: unknown): Trailer | null {
  const list = (Array.isArray(trailers) ? trailers : []) as Trailer[];
  return list.find(trailer => /gameplay/i.test(trailer.title)) ?? list[0] ?? null;
}

/** The trailer's gameplay clip: the eight-second highlight Steam plays when a game is hovered in its store (854×480
 *  H.264, muted, made to loop). Since Steam re-encoded every trailer in 2025 it sits beside the HLS stream, under the
 *  same folder; a stream stored in any other layout has no clip we can name. */
export function clipUrl(trailer: Trailer): string | null {
  return /\/hls_264_master\.m3u8$/.test(trailer.url) ? trailer.url.replace(/hls_264_master\.m3u8$/, "microtrailer.mp4") : null;
}
