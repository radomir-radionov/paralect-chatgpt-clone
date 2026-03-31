import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New chat"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 16 }).notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments").$type<unknown[] | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const anonymousQuota = pgTable("anonymous_quota", {
  sessionId: varchar("session_id", { length: 128 }).primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/** User-uploaded files (metadata + Storage path); chunks live in `document_chunks`. */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    storagePath: text("storage_path").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("processing"),
    errorText: text("error_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("documents_user_created_idx").on(t.userId, t.createdAt)],
);

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
  },
  (t) => [
    index("document_chunks_document_id_idx").on(t.documentId),
    index("document_chunks_embedding_hnsw").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

/** Guest session documents (no Storage; optional raw path empty). */
export const guestDocuments = pgTable(
  "guest_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 128 })
      .notNull()
      .references(() => anonymousQuota.sessionId, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("processing"),
    errorText: text("error_text"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("guest_documents_session_created_idx").on(t.sessionId, t.createdAt),
  ],
);

export const guestDocumentChunks = pgTable(
  "guest_document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => guestDocuments.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
  },
  (t) => [
    index("guest_document_chunks_document_id_idx").on(t.documentId),
    index("guest_document_chunks_embedding_hnsw").using(
      "hnsw",
      t.embedding.op("vector_cosine_ops"),
    ),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type GuestDocument = typeof guestDocuments.$inferSelect;
