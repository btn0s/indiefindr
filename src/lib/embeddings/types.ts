/**
 * Types for the v2 embedding-based recommendation system
 */

// =============================================================================
// FACET TYPES
// =============================================================================

export type FacetType =
  | "aesthetic" // Visual style from screenshots
  | "atmosphere" // Emotional mood/vibe
  | "mechanics" // Gameplay patterns
  | "narrative" // Theme and story
  | "dynamics"; // Pacing and feel

export type SourceType =
  | "image" // From screenshots/images
  | "text" // From text templates
  | "multimodal" // Combined image + text
  | "video"; // From video analysis

export const FACET_TYPES: FacetType[] = [
  "aesthetic",
  "atmosphere",
  "mechanics",
  "narrative",
  "dynamics",
];

// =============================================================================
// DATABASE TYPES
// =============================================================================

export interface GameEmbedding {
  id: string;
  appid: number;
  facet: FacetType;
  embedding: number[];
  embedding_model: string;
  embedding_version: number;
  source_type: SourceType;
  source_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface GameIgdbData {
  appid: number;
  igdb_id: number | null;
  themes: string[] | null;
  keywords: string[] | null;
  player_perspectives: string[] | null;
  game_modes: string[] | null;
  game_engines: string[] | null;
  storyline: string | null;
  fetched_at: string;
}

// =============================================================================
// QUERY RESULT TYPES
// =============================================================================

export interface SimilarGame {
  appid: number;
  title: string;
  header_image: string | null;
  similarity: number;
}

export interface SimilarGameWeighted extends SimilarGame {
  weighted_similarity: number;
  facet_scores: Partial<Record<FacetType, number>>;
}

export interface EmbeddingCoverage {
  facet: FacetType;
  game_count: number;
  total_games: number;
  coverage_pct: number;
}

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface FacetWeights {
  aesthetic?: number;
  atmosphere?: number;
  mechanics?: number;
  narrative?: number;
  dynamics?: number;
}

export interface EmbeddingInput {
  appid: number;
  facet: FacetType;
  embedding: number[];
  source_type: SourceType;
  source_data?: Record<string, unknown>;
  embedding_model?: string;
}

// =============================================================================
// GAME DATA TYPES (for embedding generation)
// =============================================================================

export interface GameForEmbedding {
  appid: number;
  title: string;
  header_image: string | null;
  screenshots: string[];
  short_description: string | null;
  long_description: string | null;
  steamspy_tags: Record<string, number> | null;
  raw: {
    genres?: Array<{ id: number; description: string }>;
    categories?: Array<{ id: number; description: string }>;
  } | null;
}

export interface GameWithIgdb extends GameForEmbedding {
  igdb_data?: GameIgdbData | null;
}

// =============================================================================
// EMBEDDING MODEL CONFIG
// =============================================================================

export interface EmbeddingModelConfig {
  name: string;
  dimensions: number;
  provider: "replicate" | "openai";
  model_id: string;
}

export const EMBEDDING_MODELS: Record<string, EmbeddingModelConfig> = {
  // Image embedding model
  siglip: {
    name: "SigLIP 2",
    dimensions: 768,
    provider: "replicate",
    model_id: "lucataco/siglip",
  },
  // Text embedding model
  openai_small: {
    name: "OpenAI text-embedding-3-small",
    dimensions: 1536,
    provider: "openai",
    model_id: "text-embedding-3-small",
  },
};

// Target dimension for all embeddings (for consistency)
export const TARGET_EMBEDDING_DIMENSIONS = 768;

// =============================================================================
// FACET CONFIGURATION
// =============================================================================

export interface FacetConfig {
  facet: FacetType;
  label: string;
  description: string;
  source_type: SourceType;
  embedding_model: keyof typeof EMBEDDING_MODELS;
}

export const FACET_CONFIGS: Record<FacetType, FacetConfig> = {
  aesthetic: {
    facet: "aesthetic",
    label: "Looks Like",
    description: "Similar art style and visual design",
    source_type: "image",
    embedding_model: "siglip",
  },
  atmosphere: {
    facet: "atmosphere",
    label: "Feels Like",
    description: "Similar mood and emotional atmosphere",
    source_type: "multimodal",
    embedding_model: "siglip", // Primary, with text augmentation
  },
  mechanics: {
    facet: "mechanics",
    label: "Plays Like",
    description: "Similar gameplay and mechanics",
    source_type: "text",
    embedding_model: "openai_small",
  },
  narrative: {
    facet: "narrative",
    label: "Premise",
    description: "Similar themes and story",
    source_type: "text",
    embedding_model: "openai_small",
  },
  dynamics: {
    facet: "dynamics",
    label: "Flows Like",
    description: "Similar pacing and feel",
    source_type: "text", // Will be multimodal/video in later phases
    embedding_model: "openai_small",
  },
};

// =============================================================================
// PRESET WEIGHT CONFIGURATIONS
// =============================================================================

export interface FacetPreset {
  id: string;
  label: string;
  description: string;
  weights: FacetWeights;
}

export const FACET_PRESETS: FacetPreset[] = [
  {
    id: "balanced",
    label: "Balanced",
    description: "Equal weight across all facets",
    weights: {
      aesthetic: 0.25,
      atmosphere: 0.25,
      mechanics: 0.25,
      narrative: 0.25,
    },
  },
  {
    id: "visual",
    label: "Visual Match",
    description: "Prioritizes art style and mood",
    weights: {
      aesthetic: 0.5,
      atmosphere: 0.3,
      narrative: 0.2,
    },
  },
  {
    id: "gameplay",
    label: "Gameplay Match",
    description: "Prioritizes mechanics and feel",
    weights: {
      mechanics: 0.6,
      atmosphere: 0.4,
    },
  },
  {
    id: "story",
    label: "Story Match",
    description: "Prioritizes themes and narrative",
    weights: {
      narrative: 0.5,
      atmosphere: 0.3,
      aesthetic: 0.2,
    },
  },
];
