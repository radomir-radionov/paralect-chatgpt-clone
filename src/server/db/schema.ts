import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
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

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  chatId: uuid("chat_id").references(() => chats.id, { onDelete: "set null" }),
  filename: text("filename").notNull(),
  mimeType: varchar("mime_type", { length: 128 }).notNull(),
  textContent: text("text_content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

export const anonymousQuota = pgTable("anonymous_quota", {
  sessionId: varchar("session_id", { length: 128 }).primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const anonymousDocuments = pgTable(
  "anonymous_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: varchar("session_id", { length: 128 })
      .notNull()
      .references(() => anonymousQuota.sessionId, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    textContent: text("text_content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("anonymous_documents_session_created_idx").on(
      table.sessionId,
      table.createdAt.desc(),
    ),
  ],
);

export type Profile = typeof profiles.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type DocumentRow = typeof documents.$inferSelect;
export type AnonymousDocumentRow = typeof anonymousDocuments.$inferSelect;
