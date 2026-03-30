# Paralect Chat — ChatGPT-style demo

Full-stack chat app with **streaming** assistant replies, **multi-chat** sidebar persisted in **Postgres** for **signed-in** users, **Supabase Auth**, **anonymous quota** (3 free prompts), **cross-tab sidebar sync** via Supabase Realtime broadcast, **image** paste/attach, **document** upload (.txt / .pdf) for **injected context** (signed-in **and** guests: guests use `/api/guest/documents` scoped to the anonymous session, separate from the signed-in document library), and **guest chat** that streams in the browser only (no persisted `chats` / `messages` or sidebar history after reload).

## Stack

| Layer    | Choice |
| -------- | ------ |
| UI       | Next.js 15 (App Router), React 19, TanStack Query, shadcn/ui, Tailwind CSS 4, Framer Motion |
| API      | Next.js Route Handlers (REST + SSE) |
| DB       | PostgreSQL (Supabase) + Drizzle ORM |
| Auth     | Supabase Auth (email/password) |
| Realtime | Supabase Realtime (broadcast; public client for subscribe only) |
| LLM      | Pluggable providers: OpenAI, Google Gemini, optional **OpenAI-compatible** HTTP API (`compat:…` model ids); routing in [`src/server/llm/registry.ts`](src/server/llm/registry.ts) |

**Layering:** Client code never talks to the database. All reads/writes go through `/api/*`. Server-only DB and service-role Supabase live under `src/server/`.

## Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (Postgres + Auth)
- At least one of: **OpenAI** API key, **Google AI** API key, or **OpenAI-compatible** base URL + API key (see `.env.example`)

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env.local` and fill in values:

   - `DATABASE_URL` — Supabase Postgres connection string (pooler or direct).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase → Settings → API.
   - `SUPABASE_ANON_KEY` — same as the anon key (used by API routes to validate sessions).
   - `SUPABASE_SERVICE_ROLE_KEY` — **server only**; never expose to the client.
   - `ANON_SESSION_SECRET` — long random string (≥32 characters) for signing anonymous cookies.
   - `OPENAI_API_KEY` and/or `GOOGLE_GENERATIVE_AI_API_KEY` and/or OpenAI-compatible: `OPENAI_COMPATIBLE_BASE_URL`, `OPENAI_COMPATIBLE_API_KEY`, and `OPENAI_COMPATIBLE_DEFAULT_MODEL` (the latter lists a model in `GET /api/models` and is used when the request has no `openai:` / `google:` / `compat:` prefix).

3. **Database**

   Set `DATABASE_URL` to the Postgres URI from Supabase → **Connect** (or **Project Settings → Database**). If the **direct** host `db.<project-ref>.supabase.co` fails to resolve from your machine (`getaddrinfo ENOTFOUND`), use the **Session pooler** or **Transaction pooler** URI instead (IPv4-friendly); see [Connect to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres).

   Apply migrations (or push schema):

   ```bash
   npm run db:migrate
   ```

   If you prefer `push` without migration files:

   ```bash
   npm run db:push
   ```

   Confirm tables exist:

   ```bash
   npm run db:verify
   ```

   If the CLI cannot reach the database, open **SQL Editor** in Supabase and run the statements in [`drizzle/sql-editor/0000_init.sql`](drizzle/sql-editor/0000_init.sql) (same schema as the Drizzle migration).

4. **Supabase Auth**

   In Supabase → **Authentication** → **Providers**, enable **Email**. Create a user for testing or use sign-up in the app (`/login`).

   **Email confirmation links** use a hash fragment (`#access_token=…`); only the browser can read it. After the user confirms their email, they must land on [`/auth/callback`](http://localhost:3000/auth/callback) so the app can sync session cookies. In Supabase → **Authentication** → **URL Configuration**, add these to **Redirect URLs** (adjust host for production):

   - `http://localhost:3000/auth/callback`
   - `https://<your-production-domain>/auth/callback`

   Set **Site URL** to your app origin (e.g. `http://localhost:3000` for local dev). If confirmation emails still open `/chat#…` instead of `/auth/callback#…`, the chat UI runs [`useRecoverAuthHash`](src/hooks/use-recover-auth-hash.ts) to sync cookies; prefer **`/auth/callback`** in Supabase so users are not briefly treated as guests.

   **Email sending limits:** Supabase Auth applies rate limits on sign-up and other email flows. If you see *email rate limit exceeded*, wait and retry, review **Authentication → Rate Limits** in the [dashboard](https://supabase.com/docs/guides/auth/rate-limits), and for anything beyond quick testing configure **Authentication → SMTP Settings** with your own provider (e.g. Resend, SendGrid). For local development only, you can temporarily turn off **Confirm email** under Authentication so sign-up does not send confirmation mail.

5. **Realtime (sidebar sync)**

   In Supabase → Realtime, ensure **Realtime** is enabled for the project. This app uses **broadcast** channels named `user:{uuid}` (no RLS required for broadcast).

6. **Run**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) (redirects to `/chat`).

## Scripts

| Script          | Description |
| --------------- | ----------- |
| `npm run dev`   | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint`  | ESLint |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate`  | Run migrations |
| `npm run db:push`     | Push schema (dev) |
| `npm run db:studio`   | Drizzle Studio |
| `npm run db:verify`   | List `public` tables (sanity check after migrate) |

## API overview

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/api/auth/login` | Sign in (sets session cookies) |
| `POST` | `/api/auth/signup` | Sign up |
| `POST` | `/api/auth/logout` | Sign out |
| `GET` | `/api/auth/me` | Current user (from cookies) |
| `GET` / `POST` | `/api/chats` | List / create chats (auth) |
| `GET` / `PATCH` / `DELETE` | `/api/chats/[chatId]` | Chat detail (paginated messages), rename, delete — `GET` accepts `limit` (1–200, default 100) and optional `before` (message id) for older pages |
| `POST` | `/api/chats/[chatId]/messages/stream` | Send message; **SSE** stream (`data: {"type":"token","text":"..."}` then `done`) |
| `POST` | `/api/guest/stream` | Anonymous chat stream (3 prompts max); optional `documentIds` for uploaded guest docs |
| `GET` | `/api/guest/quota` | Anonymous usage |
| `GET` / `POST` | `/api/guest/documents` | List / upload documents (anonymous session; not the signed-in library) |
| `DELETE` | `/api/guest/documents/[documentId]` | Delete guest document |
| `GET` / `POST` | `/api/documents` | List / upload documents (auth) |
| `DELETE` | `/api/documents/[documentId]` | Delete document |
| `GET` | `/api/models` | Available models (from env keys; includes `compat:…` when OpenAI-compatible env is set) |

## Deployment (e.g. Vercel)

1. Set all environment variables in the Vercel project settings.
2. Run migrations against production `DATABASE_URL` (`npm run db:migrate` in CI or locally).
3. Deploy; ensure `NEXT_PUBLIC_*` and server secrets match Supabase.

## Security notes

- Service role and LLM keys are **server-only**. The bundled `NEXT_PUBLIC_SUPABASE_ANON_KEY` is for **Realtime subscribe** only; auth uses `/api/auth/*` and server-side keys.
- `SUPABASE_ANON_KEY` (server-only) is used with `@supabase/ssr` for session cookies and `getUser()` — not shipped to the browser.
- Anonymous limits are enforced in `/api/guest/stream` using a signed cookie + `anonymous_quota` table.
- **Rate limits** (in-memory, per server instance): guest stream ~30/min per client IP; authenticated chat stream ~60/min per user. Tune in `src/server/rate-limit.ts` and the route handlers.
- **Uploads**: document **POST** rejects files larger than **5 MB** (`413`).
- **CORS**: optional **`ALLOWED_API_ORIGINS`** (comma-separated origins). When set, `middleware` adds CORS headers for `/api/*` for those origins and handles `OPTIONS` preflight.
- For production, prefer Redis/Upstash-backed rate limits, virus scanning, and stricter file policies as needed.

## License

Private / demo — adjust as needed.
