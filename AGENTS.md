# Agent / contributor brief

This repo is a **ChatGPT-style demo** (see [README.md](README.md)).

**Architecture**

- **Client:** React (Next.js App Router), **TanStack Query** — all feature data via `fetch` to `/api/*` only.
- **API:** Next.js Route Handlers (`src/app/api/**`).
- **Data:** Drizzle + Postgres; **Supabase service role** only in server code (`src/server/**`). No direct DB access from UI or Server Components for app data.
- **Auth:** Email/password flows go through **`/api/auth/*`** (password exchange uses **service role** server-side; session cookies are written via `@supabase/ssr` with **server-only** `SUPABASE_ANON_KEY`). **`GET /api/auth/me`** exposes the current user to the client. Email confirmation links land on **`/auth/callback`**; [`src/lib/supabase/browser-client.ts`](src/lib/supabase/browser-client.ts) uses the bundled anon key so `getSession()` can read `#access_token` and sync cookies (not used for password sign-in in the UI).
- **Realtime:** Supabase Realtime **broadcast** on channel `user:{userId}` for sidebar sync. The **only** bundled `NEXT_PUBLIC_SUPABASE_ANON_KEY` usage is [`src/lib/supabase/browser-client.ts`](src/lib/supabase/browser-client.ts) (Realtime re-exports it); server broadcast uses **service role** ([`src/server/realtime/broadcast.ts`](src/server/realtime/broadcast.ts)).

**Anonymous trial:** JWT cookie `anon_session` + table `anonymous_quota`; max **3** user messages without login (enforced in `/api/guest/stream`).
