# Auth: how it works (Supabase + Next.js) — short + full file map

This app uses **Supabase Auth**, but the **browser never instantiates a Supabase client**.
Instead, the browser calls same-origin **Next.js API routes** (`/api/auth/`*, `/api/profile/*`),
and the server/middleware manages the **session cookie**.

## Interview: how to explain this (copy/paste)

### 30-second overview

“We use **Supabase Auth**, but keep auth **server-owned**. The browser never creates a Supabase client; it only calls our **Next.js API routes** under `/api/auth/*`. The server sets/refreshes a **cookie-based session**, and **middleware** enforces protection for `/rooms*` and handles OAuth callbacks.”

### 2–3 minute walkthrough (what happens end-to-end)

- **Architecture choice**:
  - **Client → same-origin API only** (no Supabase SDK/client in the browser).
  - **Session in HTTP cookies** managed by server helpers.
  - **Middleware** is the “front gate”: refreshes session, applies redirects, and processes OAuth callback codes.
- **Every request** goes through middleware (`proxy.ts`):
  - Creates a cookie-aware Supabase client.
  - If the URL has an OAuth `code`, it runs `exchangeCodeForSession(code)` to create the session cookie.
  - Calls `getUser()` which can also refresh cookies.
  - Enforces access rules (guest → `/rooms*` redirects to `/login`, signed-in user → auth pages redirect to `/`).
  - Redirects after OAuth to remove `code/state` params from the URL.
- **Client auth state**:
  - UI derives auth state from `GET /api/auth/me` (React Query).
  - **401** means “no session”; otherwise the route returns the Supabase `user`.
- **Email/password sign-in**:
  - Form posts to `/api/auth/sign-in-password` (or `/api/auth/sign-up`).
  - Server calls `supabase.auth.signInWithPassword(...)` / `signUp(...)`; Supabase sets the cookie on the response.
- **Google OAuth**:
  - Client requests the provider URL from `/api/auth/sign-in-google` and navigates there.
  - On return with `?code=...`, middleware exchanges it for the session cookie.
- **Sign-out**:
  - Client calls `/api/auth/sign-out`; server clears cookie via `supabase.auth.signOut()`.
  - Client clears/invalidates auth-related React Query caches immediately to avoid stale UI.

### The “why” (what interviewers care about)

- **Security**: no Supabase keys or token handling in the browser; secrets stay server-side.
- **Control**: one place (middleware) for route gating, session refresh, and OAuth callback handling.
- **Consistency**: auth state comes from one endpoint (`/api/auth/me`), not scattered local storage logic.
- **Separation of concerns**: identity (Supabase `user`) vs domain data (`/api/profile/me`) are intentionally split.

### Common follow-ups (short answers)

- **“Why cookies?”**: Works well with SSR/middleware, avoids JS-accessible token storage, and simplifies same-origin API auth.
- **“Where do you refresh sessions?”**: In middleware with a cookie-aware Supabase client (`getUser()`), plus OAuth code exchange when present.
- **“How do you avoid UI flicker?”**: Protected routes are blocked in middleware; client state is React Query-driven and invalidated on sign-out.
- **“What if `/api/auth/me` returns 401?”**: UI treats it as signed-out; protected navigation is already gated by middleware.

## Big picture

- **Guest is allowed** on `/` (anonymous experience).
- **Protected pages** are `/rooms` and `/rooms/`*.
- **Session** is stored in **HTTP cookies**, set/cleared by server code using Supabase Auth helpers.
- **Middleware** refreshes the session (if needed) and applies redirects for protected routes.
- **Client state** is derived from `GET /api/auth/me` (React Query) and is invalidated/cleared on sign-out.

## Request flow (what happens when)

### 1) Any request (middleware)

File: `paralect/proxy.ts`

- Creates a cookie-aware Supabase client for middleware.
- If the request URL has an OAuth `code` query param (Google callback), it calls:
  - `supabase.auth.exchangeCodeForSession(code)` to create the session cookie.
- Calls `supabase.auth.getUser()` which can also refresh cookies.
- Applies route gating:
  - **Guest** visiting `/rooms`* → redirect to `/login`
  - **Signed-in** user visiting auth routes (`/login`, `/email-password`, `/google-login`) → redirect to `/`
  - After OAuth exchange, it **removes `code`/`state` from the URL** (redirect to a clean URL).

### 2) “Who am I?” (client + server)

Files:

- Client query: `paralect/domains/auth/queries/useCurrentUser.ts`
- Client fetcher: `paralect/domains/auth/queries/clientAuthFetchers.ts` (`clientGetMe`)
- API route: `paralect/app/(rooms)/api/auth/me/route.ts`
- Server helper: `paralect/shared/lib/supabase/getCurrentUser.ts`
- Server Supabase client: `paralect/shared/lib/supabase/server.ts` (used indirectly)

Flow:

- The client calls `GET /api/auth/me`.
- The API route calls `getCurrentUser()` which calls Supabase `auth.getUser()` using the cookie-bound server client.
- If there is **no session**, the route returns **401**.
- If there is a session, it returns the Supabase `user`.
- React Query stores that response under `authKeys.currentUser`.

### 3) Sign in with email/password (client → server)

Files:

- UI: `paralect/domains/auth/components/EmailPasswordForm.tsx`
- Hook/orchestration: `paralect/domains/auth/hooks/useEmailPasswordForm.ts` (used by the UI)
- Mutations:
  - `paralect/domains/auth/mutations/useSignInWithPassword.ts`
  - `paralect/domains/auth/mutations/useSignUp.ts`
- API routes:
  - `paralect/app/(rooms)/api/auth/sign-in-password/route.ts`
  - `paralect/app/(rooms)/api/auth/sign-up/route.ts`
- Supabase wrapper: `paralect/shared/lib/supabase/withSupabaseServerClient.ts`
- Input validation/types:
  - `paralect/domains/auth/schemas/auth.ts`
  - `paralect/domains/auth/types/auth.types.ts`

Flow:

- The form posts credentials to `/api/auth/sign-in-password` or `/api/auth/sign-up`.
- The API route uses `withSupabaseAuthServerClient(...)` to run `supabase.auth.signInWithPassword(...)`
or `supabase.auth.signUp(...)`.
- Supabase sets the session cookie on the response (server-side).
- After that, the client can re-check `GET /api/auth/me` and will see `user`.

### 4) Sign in with Google (OAuth)

Files:

- UI: `paralect/domains/auth/components/GoogleLoginForm.tsx`
- Mutation: `paralect/domains/auth/mutations/useSignInWithGoogle.ts`
- API route: `paralect/app/(rooms)/api/auth/sign-in-google/route.ts`
- Middleware session exchange: `paralect/proxy.ts`

Flow:

- Client calls `POST /api/auth/sign-in-google`.
- API route returns an OAuth URL.
- Client navigates the browser to that URL (`window.location.assign(url)`).
- Google redirects back to the app with `?code=...&state=...`.
- Middleware (`proxy.ts`) exchanges the `code` for a session cookie.
- Middleware then redirects to the same page **without** the `code/state` params.

### 5) Sign out

Files:

- UI button: `paralect/domains/auth/components/SignOutButton.tsx`
- Mutation: `paralect/domains/auth/mutations/useSignOut.ts`
- API route: `paralect/app/(rooms)/api/auth/sign-out/route.ts`
- Supabase wrapper: `paralect/shared/lib/supabase/withSupabaseServerClient.ts`

Flow:

- Client calls `POST /api/auth/sign-out`.
- API route runs `supabase.auth.signOut()` which clears the session cookie.
- Client immediately sets cached React Query data to:
  - `authKeys.currentUser` → `null`
  - `authKeys.myProfile` → `null`
  - cancels auth queries (to avoid races while navigation happens)
- UI navigates to `/` and refreshes.

## Profile (“server-owned” user data)

This is *not* the Supabase Auth user object. It’s app-specific profile data fetched from API routes.

Files:

- Client query + fetcher: `paralect/domains/auth/queries/clientAuthFetchers.ts` (`clientGetProfile`)
- Client query hook: `paralect/domains/auth/queries/useProfile.ts`
- Profile types/server fetch helper: `paralect/domains/auth/queries/profile-fetcher.ts`
- API route: `paralect/app/(rooms)/api/profile/me/route.ts`

Behavior notes:

- `GET /api/profile/me` can return `401`/`404` after sign-out; the client maps those to `null`.

## File map (all auth-related code paths)

### Rules / documentation

- `paralect/.cursor/rules/features/features-auth.md`: internal map + conventions (this is the “source of truth” list).
- `paralect/docs/auth-how-it-works.md`: this doc.

### Middleware / routing gate

- `paralect/proxy.ts`: session refresh + route gating + OAuth code exchange + query param cleanup.
- `paralect/shared/lib/supabase/middleware.ts`: creates the middleware Supabase client (cookie-aware).

### Supabase auth server helpers (cookie-bound)

- `paralect/shared/lib/supabase/server.ts`: creates a Supabase Auth server client (anon key + cookies).
- `paralect/shared/lib/supabase/withSupabaseServerClient.ts`: helper wrapper used by auth API routes so cookies are applied to responses.
- `paralect/shared/lib/supabase/getCurrentUser.ts`: `auth.getUser()` wrapper used by server components/API routes.

### Auth API routes (server)

- `paralect/app/(rooms)/api/auth/me/route.ts`: returns current Supabase user (401 if not signed in).
- `paralect/app/(rooms)/api/auth/sign-in-password/route.ts`: email/password sign-in.
- `paralect/app/(rooms)/api/auth/sign-up/route.ts`: email/password sign-up.
- `paralect/app/(rooms)/api/auth/sign-in-google/route.ts`: returns Google OAuth URL.
- `paralect/app/(rooms)/api/auth/sign-out/route.ts`: signs out (clears cookie).

### Profile API routes (server)

- `paralect/app/(rooms)/api/profile/me/route.ts`: returns the app profile for the signed-in user.

### Client-side queries (React Query)

- `paralect/domains/auth/queries/keys.ts`: query keys (`authKeys.`*).
- `paralect/domains/auth/queries/clientAuthFetchers.ts`:
  - `clientGetMe()` → `GET /api/auth/me`
  - `clientGetProfile()` → `GET /api/profile/me`
  - query option helpers (`meQueryOptions`, `myProfileQueryOptions`)
- `paralect/domains/auth/queries/useCurrentUser.ts`: small wrapper around `meQueryOptions()`.
- `paralect/domains/auth/queries/useProfile.ts`: wrapper hook for loading the current user profile.
- `paralect/domains/auth/api/getMe.ts`: server-side wrapper that forwards cookies/headers (used from server code).
- `paralect/domains/auth/api/getMyProfile.ts`: same idea for profile (used from server code).

### Client-side mutations

- `paralect/domains/auth/mutations/useSignInWithPassword.ts`: calls `/api/auth/sign-in-password`.
- `paralect/domains/auth/mutations/useSignUp.ts`: calls `/api/auth/sign-up`.
- `paralect/domains/auth/mutations/useSignInWithGoogle.ts`: calls `/api/auth/sign-in-google` then navigates to OAuth URL.
- `paralect/domains/auth/mutations/useSignOut.ts`: calls `/api/auth/sign-out` then clears/cancels auth queries.

### Auth UI

- `paralect/app/login/page.tsx`: login entry page composition.
- `paralect/domains/auth/components/AuthPageShell.tsx`: login page layout shell.
- `paralect/domains/auth/components/EmailPasswordForm.tsx`: email/password card UI.
- `paralect/domains/auth/components/GoogleLoginForm.tsx`: Google OAuth card UI.
- `paralect/domains/auth/components/SignOutButton.tsx`: sign-out button behavior (push `/`, refresh).
- `paralect/domains/auth/components/AppAuthBar.tsx`: header UI with sign-out.

## Two important constraints (why it’s built this way)

- **No keys in the browser**: the client uses `fetch("/api/...")`; secrets stay server-only.
- **DB access is server-owned**: app data reads/writes go through server routes using the admin client (`SUPABASE_SECRET_KEY`), not from the browser.

