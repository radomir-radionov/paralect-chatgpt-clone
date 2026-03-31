-- Gemini embeddings: 768-d vectors (paste if migrate cannot run). Clears chunk rows — re-upload documents after running.

DROP INDEX IF EXISTS "document_chunks_embedding_hnsw";
DROP INDEX IF EXISTS "guest_document_chunks_embedding_hnsw";

DELETE FROM "document_chunks";
DELETE FROM "guest_document_chunks";

ALTER TABLE "document_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(768);
ALTER TABLE "guest_document_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(768);

CREATE INDEX "document_chunks_embedding_hnsw" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX "guest_document_chunks_embedding_hnsw" ON "guest_document_chunks" USING hnsw ("embedding" vector_cosine_ops);
