export type SuggestionCategory = "same-developer" | "niche" | "popular";

export type Suggestion = {
  appId: number;
  title: string;
  explanation: string;
  category?: SuggestionCategory;
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

export type SavedList = {
  id: string;
  owner_id: string;
  title: string;
  is_default: boolean;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type SavedListGame = {
  list_id: string;
  appid: number;
  created_at: string;
};

export type SavedListWithGames = SavedList & {
  games: GameCardGame[];
};

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};
