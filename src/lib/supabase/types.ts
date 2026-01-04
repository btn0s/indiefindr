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

export type Collection = {
  id: string;
  title: string;
  description: string | null;
  pinned: boolean;
  pinned_rank: number;
  created_at: string;
  updated_at: string;
};

export type CollectionItem = {
  collection_id: string;
  appid: number;
  created_at: string;
};
