ALTER TABLE "finds" DROP COLUMN "vector_embedding";
ALTER TABLE "finds" ADD COLUMN "vector_embedding" vector(512);
DROP INDEX IF EXISTS idx_finds_vector_embedding;
CREATE INDEX IF NOT EXISTS idx_finds_vector_embedding ON "finds" USING hnsw (vector_embedding vector_cosine_ops);