import type { Database } from "./database.types";

export type SuggestionCategory = "same-developer" | "niche" | "popular";

export type Suggestion = {
  appId: number;
  title: string;
  explanation: string;
  category?: SuggestionCategory;
};

export type GameNew = Database["public"]["Tables"]["games_new"]["Row"];
export type Collection = Database["public"]["Tables"]["collections"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export type GameCardGame = Pick<GameNew, "appid" | "title" | "header_image">;

export type CollectionWithPreview = Collection & {
  preview_games: GameCardGame[];
  total_games_count?: number;
};

export type SavedList = Collection;
export type SavedListGame = {
  list_id: string;
  appid: number;
  created_at: string;
};
export type SavedListWithGames = Collection & {
  games: GameCardGame[];
};
