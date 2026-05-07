# Paralect

Next.js (App Router) + TypeScript app with Supabase Auth and an AI chat experience (streaming, threads, attachments).

task link: https://www.paralect.com/academy/product-engineer/projects/chatbot

## Prerequisites

- Node.js **20+** (recommended)
- npm (or a compatible package manager)
- A Supabase project (URL + keys)
- At least one AI provider key (OpenAI **or** Google Gemini **or** Groq), if you want to use the chat

## Quickstart (local dev)

If you already have a Supabase project, the fastest path is:

```bash
cd paralect
npm install
cp .env.example .env.local
npm run db:push
npm run db:types
npm run dev
```

Then open `http://localhost:3000`.

If `db:push` fails (VPN/Tailscale/IPv6 is a common culprit), jump to the troubleshooting section below and/or apply migrations via the Supabase Dashboard SQL Editor.

## Getting started (step-by-step)

### 0) Supabase setup (required for a fully working app)

You need a Supabase project with:

- **Auth enabled** (Email/password works out of the box; enable Google OAuth only if you want it)
- **Redirect URLs** set for local development (so OAuth/callback flows can return to your app)
  - Add `http://localhost:3000` to the allowed redirect / site URLs in Supabase Auth settings
- **Database migrations** from `supabase/migrations/` applied in timestamp order (see below)

### Apply database migrations

Apply migrations to your Supabase project **in timestamp order**. Either:

- **Supabase CLI (linked project):** from the `paralect` directory, `npm run db:push`, or
- **Dashboard:** SQL Editor — paste and run each file in order.

#### Supabase CLI linking (required for `npm run db:push` / `npm run db:types`)

The `db:*` scripts run the Supabase CLI via `npx` and expect the repo to be linked to your Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

After linking, `npm run db:push` and `npm run db:types` should work.

Include every file under `supabase/migrations/`, at minimum:

1. `20260422100000_migrate_rooms_to_ai_threads.sql`
2. `20260424120000_add_message_attachments.sql`
3. `20260425112710_add_document_attachments.sql`
4. `20260427124000_optimize_message_attachment_lookup.sql`
5. `20260427160000_disable_rls_and_drop_policies.sql`
6. `20260504100000_move_app_tables_to_private_schema.sql` — moves app tables into `app_private` and locks down grants + trigger function.

After the database reflects `app_private`, regenerate TypeScript types (same schema the admin client uses):

```bash
npm run db:types
```

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

- **Required (browser)**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Required (server/admin operations)**
  - `SUPABASE_SECRET_KEY`
- **Required for chat (pick at least one provider)**
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

#### Troubleshooting `npm run db:push` (`tls error` / `socket is not connected`)

If the CLI shows your machine connecting from an IPv6 address like **`fd58:…`** (often **Tailscale** or another VPN), TLS to Supabase’s Postgres host can fail mid-handshake.

1. **Pause or disconnect Tailscale / VPN**, then run `npm run db:push` again (same Wi‑Fi, no overlay routing).
2. **CLI workaround:** some versions behave differently with `--debug` — try `npm run db:push:debug`.
3. **Bypass the CLI:** open **Supabase Dashboard → SQL Editor**, paste each migration file in timestamp order, and run manually (same outcome as `db:push`).
4. **Pooler URL (fallback):** in **Project Settings → Database**, copy the **connection pooling** URI (port **6543**), then run  
   `npx supabase db push --linked --yes --db-url '<paste-uri-with-sslmode=require>'`  
   Prefer fixing VPN/IPv6 first; pooling can be picky about some DDL.

5. **Both `public` and `app_private` had chat tables (42P07 or duplicate data):** migration `20260504100000_move_app_tables_to_private_schema.sql` reconciles automatically: empty `app_private` shells are dropped and `public` is moved; if **both** schemas have rows, it **`INSERT … ON CONFLICT (id) DO NOTHING`** from `public` into `app_private` (FK order: profile → room → message → attachment), then **drops** the `public` copies so only `app_private` remains. Rows that exist only in `app_private` are kept as-is when IDs clash.

6. **`PGRST106` / `Invalid schema: app_private` in server logs (e.g. `[ensureUserProfileExists]`):** add **`app_private`** under **Project Settings → Data API → Exposed schemas** (see checklist item 5 below). If you already added it, wait a minute or run `NOTIFY pgrst, 'reload schema';` in the SQL Editor so PostgREST picks up the change.

### Post-deploy checklist (staging / production)

Do these once per environment after migrations are applied:

1. Run `npm run db:types` and commit if the generated `shared/lib/supabase/types/database.ts` differs (optional if types already match).
2. Run `npm run build` and smoke-test: sign-in, new chat, messages, attachment upload, room list, delete room.
3. **Supabase Dashboard → Security Advisor:** confirm CRITICAL “RLS disabled in public” for app tables is gone (tables are no longer in `public`).
4. **Authentication → Policies:** enable **Leaked password protection** (HaveIBeenPwned).
5. **Settings → API → Exposed schemas:** include **`app_private`** alongside `public` (and `graphql_public` if present). PostgREST returns **`PGRST106 Invalid schema: app_private`** if this schema is missing, because the server-side admin client queries tables through the API with `Content-Profile` / `Accept-Profile` set to `app_private` (see [Using custom schemas](https://supabase.com/docs/guides/api/using-custom-schemas)). **Exposure does not grant anon users access to your data:** migrations revoke `USAGE` on `app_private` from `anon` and `authenticated` and only grant table privileges to `postgres` and `service_role`; the browser never uses the service role key.

## How the backend is wired (important context)

**Database model:** Application tables live in the **`app_private` Postgres schema**. They are **not** exposed to PostgREST for the anon key: only `service_role` (server-side, via `SUPABASE_SECRET_KEY`) is granted access. Row Level Security (RLS) is **off** on these tables; authorization is enforced in Next.js API routes (`getCurrentUser()` + ownership checks on `owner_id` / `author_id`).

**Storage:** Chat attachments use the private bucket **`chat-attachments`**. The app uses the service-role client for uploads and signed URLs — clients never talk to Storage with credentials that bypass your API.

## Scripts

```bash
npm run dev       # start dev server
npm run build     # production build
npm run start     # start production server
npm run lint      # run eslint
npm run db:push        # push migrations to linked Supabase project
npm run db:push:debug  # same, with --debug (TLS/connectivity quirks)
npm run db:types  # regenerate shared/lib/supabase/types/database.ts for app_private
```
