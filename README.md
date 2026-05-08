# Paralect

Next.js (App Router) + TypeScript app with Supabase Auth and an AI chat experience (streaming, threads, attachments).

Project brief: `https://www.paralect.com/academy/product-engineer/projects/chatbot`  
Demo recording: `https://www.loom.com/share/c546758b556c401a8348c98e885f2a7e`

## Prerequisites

- Node.js **20+** (recommended)
- npm (or a compatible package manager)
- A Supabase project (URL + keys)
- At least one AI provider key (OpenAI **or** Google Gemini **or** Groq), if you want to use the chat

## Start the project (local dev)

```bash
cd paralect
npm install
cp .env.example .env.local

# fill .env.local:
# - SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SECRET_KEY
# - one of: OPENAI_API_KEY | GOOGLE_GENERATIVE_AI_API_KEY | GROQ_API_KEY

# (once) link Supabase project for db:* scripts
npx supabase login
npx supabase link --project-ref <your-project-ref>

# apply all migrations from supabase/migrations/
npm run db:push
npm run db:types

npm run dev
```

Open `http://localhost:3000`.

## Architecture

- **Chat** uses a domain-first layout (`domains/chat/`): capability folders (`attachments`, `guest`, `streaming`), shared `types/`, and signed-in surface under `room/` (`room/components`, `room/queries`, …). Conventions are documented in [`domains/chat/README.md`](domains/chat/README.md).

## Notes

- If `npm run db:push` fails, try disabling VPN/Tailscale or apply migrations in **Supabase Dashboard → SQL Editor**.
- If you see `PGRST106 Invalid schema: app_private`, add `app_private` in **Project Settings → Data API → Exposed schemas**.

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
