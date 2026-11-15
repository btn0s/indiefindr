export type Trailer = { title: string; url: string; poster: string | null };

export function pickTrailer(trailers: unknown): Trailer | null {
  const list = (Array.isArray(trailers) ? trailers : []) as Trailer[];
  return list.find(trailer => /gameplay/i.test(trailer.title)) ?? list[0] ?? null;
}

export function clipUrl(trailer: Trailer): string | null {
  return /\/hls_264_master\.m3u8$/.test(trailer.url) ? trailer.url.replace(/hls_264_master\.m3u8$/, "microtrailer.mp4") : null;
}
