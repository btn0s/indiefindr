export type Suggestion = {
  appId: number;
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
