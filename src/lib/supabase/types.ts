export type Suggestion = {
  appId: number;
  title: string; // Original title from Perplexity (for fallback lookup if appId fails)
  explanation: string;
};

export type GameNew = {
  appid: number;
  screenshots: string[];
  videos: string[];
  title: string;
  header_image: string | null;
  short_description: string | null;
  long_description: string | null;
  raw: unknown;
  suggested_game_appids: Suggestion[] | null;
  created_at: string;
  updated_at: string;
};

export type GameCardGame = Pick<GameNew, "appid" | "title" | "header_image" | "videos">;

export type Collection = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionGame = {
  collection_id: string;
  appid: number;
  position: number;
  created_at: string;
};

export type CollectionPin = {
  id: string;
  collection_id: string;
  context: "home" | "game";
  game_appid: number | null;
  position: number;
  created_at: string;
};

export type CollectionWithPreview = Collection & {
  preview_games: GameCardGame[];
  total_games_count?: number;
};
