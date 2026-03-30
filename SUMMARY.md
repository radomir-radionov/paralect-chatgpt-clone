# Project summary — Paralect Chat

## Overview

A **ChatGPT-style** web demo: streamed assistant replies, a **left sidebar** of persisted chats for signed-in users, **Supabase Auth**, **anonymous trial** (3 free prompts), **Supabase Realtime** for cross-tab sidebar updates, **images** (paste/attach), and **document upload** (.txt / .pdf) for **injected context** in LLM calls. **Anonymous (guest) chats** are streamed in the browser only—they are **not** stored as `chats` / `messages` rows, so there is no persisted guest sidebar or history after reload.

## Stack


| Layer         | Technology                                                                         |
| ------------- | ---------------------------------------------------------------------------------- |
| App           | Next.js 15 (App Router), React 19                                                  |
| Data fetching | TanStack Query (client → REST only)                                                |
| UI            | shadcn/ui, Tailwind CSS 4, Framer Motion                                           |
| API           | Next.js Route Handlers (REST + SSE)                                                |
| Database      | PostgreSQL (Supabase), Drizzle ORM                                                 |
| Auth          | Supabase Auth (email/password)                                                     |
| Realtime      | Supabase Realtime **broadcast** (`user:{userId}`)                                  |
| LLM           | OpenAI (`gpt-4o-mini`) and/or Google Gemini (`gemini-2.0-flash`), selectable in UI |


## Architecture rules

- **Client** never queries the database; all feature data flows **TanStack Query → `/api/*`**.
- **Server**: Drizzle + Postgres and **Supabase service role** only in API routes / `src/server/`**.
- **Browser Supabase client** (anon key) is used for **auth session** and **Realtime subscriptions** only—not for direct table mutations from the client.
- Secrets (LLM keys, service role, DB URL, anon session secret) stay in **environment variables**; see `.env.example`.

## Features (mapped)


| Requirement              | Implementation                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| Stream messages          | SSE (`text/event-stream`) with JSON lines `token` / `done` / `error`                         |
| Multiple LLMs            | `modelId` prefixes `openai:` / `google:` in `src/server/llm/stream.ts`                       |
| Chat list + persistence  | `profiles`, `chats`, `messages` tables; CRUD under `/api/chats` (signed-in only)               |
| Guest chat persistence   | Not persisted: guest messages live in client state only; no DB chat rows or sidebar list   |
| Login                    | `/login`; session via cookies + middleware refresh                                           |
| Images                   | Base64 + MIME in JSON to stream routes; vision-capable models                                |
| 3 free questions (guest) | Signed cookie `anon_session` + `anonymous_quota` table; `429` when exceeded                  |
| Cross-tab sync           | Server broadcast after chat create/delete/update; client subscribes on `user:{id}`           |
| Documents                | Signed-in: `/api/documents`. Guest: `/api/guest/documents` (scoped to anon session). Text extracted server-side; selectable as context per send |


## Codebase verification (feature map)

Where each capability is implemented (for audits and onboarding).

| Area | Where |
| ---- | ----- |
| Auth stream (SSE) | `POST /api/chats/[chatId]/messages/stream` — [`src/app/api/chats/[chatId]/messages/stream/route.ts`](src/app/api/chats/[chatId]/messages/stream/route.ts) (`sseResponse`, `streamLlmCompletion`) |
| Guest stream | `POST /api/guest/stream` — [`src/app/api/guest/stream/route.ts`](src/app/api/guest/stream/route.ts) |
| Client SSE parsing | [`parseSseStream`](src/lib/api-client.ts) in [`chat-main.tsx`](src/components/chat/chat-main.tsx) (guest + signed-in) |
| LLM routing | [`streamLlmCompletion`](src/server/llm/stream.ts): `openai:*` → OpenAI, `google:*` → Gemini; unknown `modelId` falls back to OpenAI `gpt-4o-mini` when `OPENAI_API_KEY` is set, otherwise to a default Gemini model when only Google is configured |
| Models API | [`GET /api/models`](src/app/api/models/route.ts) — `503` if no LLM keys |
| Anonymous quota | `MAX_FREE = 3` in [`src/server/anon/quota.ts`](src/server/anon/quota.ts); `assertAnonymousQuota` / `incrementAnonymousUsage` on guest stream |
| Cross-tab sync | [`useRealtimeChats`](src/hooks/use-realtime-chats.ts) (`chat_created` / `chat_updated` / `chat_deleted`); [`broadcastChatEvent`](src/server/realtime/broadcast.ts) from chat routes |
| Documents as context | Signed-in: `loadDocumentContext` (helper in [`messages/stream/route.ts`](src/app/api/chats/[chatId]/messages/stream/route.ts)) + `documentIds` on POST body. Guest: [`guestStreamSchema`](src/lib/validation/chat.ts) accepts `documentIds`; [`chat-main.tsx`](src/components/chat/chat-main.tsx) sends them; [`loadAnonymousDocumentContext`](src/server/documents/anonymous-context.ts) in [`guest/stream/route.ts`](src/app/api/guest/stream/route.ts). |


## Main API surface

- `GET` / `POST` `/api/chats` — list / create chats  
- `GET` / `PATCH` / `DELETE` `/api/chats/[chatId]` — detail, rename, delete  
- `POST` `/api/chats/[chatId]/messages/stream` — user message + streamed assistant reply  
- `POST` `/api/guest/stream`, `GET` `/api/guest/quota` — anonymous chat and quota  
- `GET` / `POST` `/api/guest/documents`, `DELETE` `/api/guest/documents/[documentId]` — guest document library (anon session)  
- `GET` / `POST` `/api/documents`, `DELETE` `/api/documents/[documentId]` — documents (signed-in)  
- `GET` `/api/models` — models available from configured env keys

## Key directories

- `src/app/api/` — REST + SSE handlers  
- `src/server/db/` — Drizzle schema and DB client  
- `src/server/llm/` — streaming adapters  
- `src/server/anon/` — anonymous quota + JWT cookie  
- `src/server/realtime/` — broadcast helper  
- `src/components/chat/chat-main.tsx` — main chat UI  
- `drizzle/` — SQL migrations

## Documentation

- **Setup and run:** [README.md](./README.md)  
- **Contributor / agent brief:** [AGENTS.md](./AGENTS.md)

## Submission checklist (demo rubric)

- README with env, scripts, and Supabase steps  
- Screen recording: login, new chat, streaming, images, documents, guest limit, two tabs  
- Optional: deploy to Vercel (or similar) with env vars documented

