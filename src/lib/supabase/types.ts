export type Game = {
  id: number;
  name: string;
  description: string | null;
  header_image: string | null;
  screenshots: string[] | null;
  videos: string[] | null;
  tags: Record<string, number> | null;
  review_summary: Record<string, any> | null;
  aesthetic_text: string | null;
  gameplay_text: string | null;
  narrative_text: string | null;
  aesthetic_embedding: number[] | null;
  gameplay_embedding: number[] | null;
  narrative_embedding: number[] | null;
  vision_model: string | null;
  embedding_model: string | null;
  steam_type: string | null;
  steam_required_age: number | null;
  steam_categories: Array<{ id: number; description: string }> | null;
  created_at: string;
  updated_at: string;
};

export type IngestJob = {
  id: string;
  steam_url: string;
  steam_appid: number | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  created_at: string;
  updated_at: string;
};

export type RelatedGame = {
  appid: number;
  name: string;
  header_image: string | null;
  videos: string[] | null;
  similarity: number;
};

export type ManualSimilarity = {
  id: string;
  source_appid: number;
  target_appid: number;
  facets: string[] | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
