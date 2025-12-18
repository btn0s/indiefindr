export type Game = {
  id: number;
  name: string;
  description: string | null;
  header_image: string | null;
  screenshots: string[] | null;
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
  similarity: number;
};
