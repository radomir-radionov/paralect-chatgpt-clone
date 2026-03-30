CREATE TABLE "anonymous_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" varchar(128) NOT NULL,
	"filename" text NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"text_content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "anonymous_documents" ADD CONSTRAINT "anonymous_documents_session_id_anonymous_quota_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."anonymous_quota"("session_id") ON DELETE cascade ON UPDATE no action;