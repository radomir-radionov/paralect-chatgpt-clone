DROP INDEX IF EXISTS "document_chunks_embedding_hnsw";
--> statement-breakpoint
DROP INDEX IF EXISTS "guest_document_chunks_embedding_hnsw";
--> statement-breakpoint
DELETE FROM "document_chunks";
--> statement-breakpoint
DELETE FROM "guest_document_chunks";
--> statement-breakpoint
ALTER TABLE "document_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(768);
--> statement-breakpoint
ALTER TABLE "guest_document_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(768);
--> statement-breakpoint
CREATE INDEX "document_chunks_embedding_hnsw" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX "guest_document_chunks_embedding_hnsw" ON "guest_document_chunks" USING hnsw ("embedding" vector_cosine_ops);
