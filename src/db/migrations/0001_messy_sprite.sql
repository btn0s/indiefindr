ALTER TABLE "finds" ADD COLUMN "vector_embedding" vector(1536);
CREATE INDEX IF NOT EXISTS idx_finds_vector_embedding ON "finds" USING hnsw (vector_embedding vector_cosine_ops);