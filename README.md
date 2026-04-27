# Paralect

Next.js (App Router) + TypeScript app with Supabase Auth and an AI chat experience (streaming, threads, attachments).

## Prerequisites

- Node.js **20+** (recommended)
- npm (or a compatible package manager)
- A Supabase project (URL + keys)
- At least one AI provider key (OpenAI **or** Google Gemini **or** Groq), if you want to use the chat

## Getting started (local dev)

### 0) Supabase setup (required for a fully working app)

You need a Supabase project with:

- **Auth enabled** (Email/password works out of the box; enable Google OAuth only if you want it)
- **Redirect URLs** set for local development (so OAuth/callback flows can return to your app)
  - Add `http://localhost:3000` to the allowed redirect / site URLs in Supabase Auth settings
- **Database schema + RLS + Storage policies** applied via the migrations in `supabase/migrations/`

### Apply database migrations

This repo keeps Supabase migrations as SQL files in `supabase/migrations/`. Apply them to your Supabase project **in timestamp order**:

1. `supabase/migrations/20260422100000_migrate_rooms_to_ai_threads.sql`
2. `supabase/migrations/20260424120000_add_message_attachments.sql`
3. `supabase/migrations/20260425112710_add_document_attachments.sql`

The easiest way is **Supabase Dashboard → SQL Editor** (paste & run each file).

> Note: these migrations create the core tables (`chat_room`, `message`, `user_profile`, `message_attachment`), enable **RLS policies**, and configure a private Storage bucket (`chat-attachments`) + per-user prefix policies.

### 1) Install dependencies

```bash
cd paralect
npm install
```

### 2) Configure environment variables

Create a local env file (do **not** commit it):

```bash
cp .env.example .env.local
```

Fill in values in `.env.local`:

- **Required**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Required for server/admin operations**
  - `SUPABASE_SECRET_KEY`
- **Required (pick at least one)**
  - `OPENAI_API_KEY` (OpenAI models)
  - `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini models)
  - `GROQ_API_KEY` (Groq models)
- **Optional**
  - `UNSTRUCTURED_API_URL` + `UNSTRUCTURED_API_KEY` (only if you use Unstructured-powered features)
  - `NEXT_PUBLIC_CHAT_PACING` (set to `"0"` to disable streamed text pacing)

### 3) Start the dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev    # start dev server
npm run build  # production build
npm run start  # start production server
npm run lint   # run eslint
```
