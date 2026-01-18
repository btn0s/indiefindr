export type GameNew = {
  appid: number;
  screenshots: string[];
  videos: string[];
  title: string;
  header_image: string | null;
  short_description: string | null;
  long_description: string | null;
  raw: unknown;
  steamspy_tags: Record<string, number> | null;
  steamspy_owners: string | null;
  steamspy_positive: number | null;
  steamspy_negative: number | null;
  steamspy_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type GameCardGame = Pick<GameNew, "appid" | "title" | "header_image">;

export type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
  pinned_to_home: boolean;
  home_position: number;
  created_at: string;
  updated_at: string;
};

export type CollectionWithPreview = Collection & {
  preview_games: GameCardGame[];
  total_games_count?: number;
};
