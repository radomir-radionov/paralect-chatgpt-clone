CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
DROP TABLE IF EXISTS "anonymous_documents";
--> statement-breakpoint
DROP TABLE IF EXISTS "documents";
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"storage_path" text NOT NULL,
	"status" varchar(32) DEFAULT 'processing' NOT NULL,
	"error_text" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guest_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"filename" text NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"status" varchar(32) DEFAULT 'processing' NOT NULL,
	"error_text" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "guest_document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guest_documents" ADD CONSTRAINT "guest_documents_session_id_anonymous_quota_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."anonymous_quota"("session_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "guest_document_chunks" ADD CONSTRAINT "guest_document_chunks_document_id_guest_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."guest_documents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "documents_user_created_idx" ON "documents" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX "document_chunks_document_id_idx" ON "document_chunks" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "document_chunks_embedding_hnsw" ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX "guest_documents_session_created_idx" ON "guest_documents" USING btree ("session_id","created_at");
--> statement-breakpoint
CREATE INDEX "guest_document_chunks_document_id_idx" ON "guest_document_chunks" USING btree ("document_id");
--> statement-breakpoint
CREATE INDEX "guest_document_chunks_embedding_hnsw" ON "guest_document_chunks" USING hnsw ("embedding" vector_cosine_ops);
--> statement-breakpoint
ALTER TABLE "documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guest_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "guest_document_chunks" ENABLE ROW LEVEL SECURITY;
