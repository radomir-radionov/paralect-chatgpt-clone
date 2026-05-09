# Chat: how it works (rooms + streaming + attachments + cross-tab sync) — short + full file map

This app supports two chat experiences:

- **Guest chat (logged-out)**: local-only transcript + server-enforced quota + streaming via `POST /api/guest/messages/stream`.
- **Authenticated chat (logged-in)**: personal threads (“rooms”) stored in Postgres + streaming via `POST /api/rooms/:roomId/messages/stream`.

Like auth, chat is **server-owned**: the browser uses same-origin `fetch("/api/...")` and does **not** instantiate a Supabase client for DB/Storage access.

## Constraints & non-features (important context)

- **No Supabase Realtime**: the app currently uses `BroadcastChannel` for cross-tab sync (`paralect/shared/lib/query/chatCrossTabSync.ts`).
- **RLS is disabled for chat tables**: route handlers enforce ownership (see `features-chat.md` for migration reference and security checklist).
- **Removed from the product**:
  - multi-user membership (`chat_room_member`)
  - join/leave/invite flows
  - public room discovery

## Interview: how to explain this (copy/paste)

### 30-second overview

“We have two chat modes. Logged-out users get a guest chat that streams responses but stores the transcript locally and enforces a server-side quota. Logged-in users get personal chat threads: we create a `chat_room`, then stream assistant replies from a Next.js API route that persists both the user message and assistant message to Postgres. Attachments upload via a server route into private Supabase Storage, are persisted as `message_attachment` rows, and are rendered through a signed-URL redirect endpoint. Cross-tab consistency is handled with `BroadcastChannel` invalidations + TanStack Query refetch.”

### 2–3 minute walkthrough (what happens end-to-end)

- **Architecture choice**:
  - Client calls **same-origin API routes only** for chat (`/api/rooms/*`, `/api/uploads/*`, `/api/guest/*`).
  - Server routes use `createSupabaseAdminClient()` for DB/Storage (service role).
  - Chat tables have **RLS disabled**; ownership is enforced in API routes (auth + room ownership checks).
- **Guest flow (logged-out)**:
  - UI keeps a **local transcript** and calls `POST /api/guest/messages/stream` for streaming replies.
  - Server enforces **quota** and streams `text/plain` chunks back to the client.
- **Authenticated flow (threads/rooms)**:
  - Home composer creates a room first (`POST /api/rooms`), then sends the first turn by streaming (`POST /api/rooms/:roomId/messages/stream`).
  - `useSendMessage` does optimistic UI: **user message + assistant placeholder** immediately, then updates assistant text from streamed chunks.
  - Server persists: user message (when needed), builds history from DB rows, streams assistant deltas, then persists assistant message and updates `chat_room.last_message_at`.
  - Refresh mid-stream is recoverable: the thread client can resume by streaming an assistant reply for the last persisted user message (`assistant_only` mode).
- **Attachments**:
  - Browser uploads files to `POST /api/uploads/chat-attachment` (server uploads to private bucket `chat-attachments`).
  - Client sends attachment metadata (including `storagePath`) with the streamed message request; server normalizes + persists `message_attachment`.
  - Message bubbles render attachments via `GET /api/rooms/:roomId/attachments/:attachmentId` which redirects to a short-lived signed URL.
- **Cross-tab sync**:
  - Mutations broadcast “invalidate” events using `BroadcastChannel`.
  - Other tabs invalidate TanStack Query caches and refetch; queries also refetch on focus as a backstop.

### The “why” (what interviewers care about)

- **Security**: no provider API keys or Supabase service role capabilities in the browser; server controls DB/Storage and streams sanitized errors.
- **Consistency**: all state is derived from DB + TanStack Query caches; cross-tab invalidation prevents stale sidebars / message lists.
- **Resilience**: refresh mid-stream can be recovered (`assistant_only`), and failures still produce a persisted assistant message rather than a generic “Failed to fetch”.
- **Performance**: streamed text updates are batched (animation-frame pacing) to avoid render starvation.

## Big picture

- **Guest**: streams, stores transcript locally, quota enforced server-side.
- **Signed-in**: threads (“rooms”) live in Postgres: `chat_room` + `message` + `message_attachment`.
- **Streaming**: `POST /api/rooms/:roomId/messages/stream` returns `text/plain` chunks and persists messages.
- **Storage**: attachments are stored privately in Supabase Storage (`chat-attachments`) and rendered via a signed-URL redirect route.
- **No Realtime**: cross-tab sync is currently implemented with `BroadcastChannel` (not Supabase Realtime).

## Request flow (what happens when)

### 0) App shell: signed-in vs guest layout

Files:

- `paralect/app/(rooms)/layout.tsx`
- `paralect/domains/chat/room/components/ChatLayoutShell.tsx`
- `paralect/domains/chat/room/components/ChatSidebar.tsx`
- `paralect/domains/chat/room/components/ChatSidebarClient.tsx`
- Joined rooms API + fetchers:
  - `paralect/app/(rooms)/api/rooms/joined/route.ts`
  - `paralect/domains/chat/room/api/getJoinedRooms.ts`
  - `paralect/domains/chat/room/queries/room-fetchers.ts` (`fetchJoinedRooms`)

Moments:

- Server layout calls `getMe()` (`paralect/domains/auth/api/getMe.ts`).
- **If signed in**:
  - Prefetches `chatKeys.joinedRooms(user.id)` and renders `ChatLayoutShell` with a hydrated sidebar.
  - Sidebar initial data path:
    - `ChatSidebar` (Server Component) calls `getJoinedRooms()` → `GET /api/rooms/joined`.
    - `ChatSidebarClient` (Client Component) hydrates interactivity and keeps the list fresh with `useJoinedRooms(userId)`.
- **If guest**:
  - Renders a minimal full-viewport wrapper (no sidebar).

### 1) Home page: guest chat vs new-room composer

Files:

- `paralect/app/(rooms)/page.tsx`
- Guest UI: `paralect/domains/chat/guest/components/GuestChat.tsx`
- Signed-in UI: `paralect/domains/chat/room/components/NewRoomComposer.tsx`

Moments:

- **If guest**: renders `GuestChat` (local transcript + quota + guest streaming endpoint).
- **If signed in**: renders `NewRoomComposer` (create-room-first flow).

### 2) Guest chat: submit → quota → stream → local transcript

Files:

- Submit orchestration: `paralect/domains/chat/guest/hooks/useGuestChatSubmit.ts`
- Local storage/hydration:
  - `paralect/domains/chat/guest/hooks/useGuestChatStorage.ts`
  - `paralect/domains/chat/guest/hooks/useClientHydrated.ts`
- Quota:
  - `paralect/domains/chat/guest/hooks/useGuestQuota.ts`
  - `paralect/domains/chat/guest/lib/guestQuotaConstants.ts`
- API: `paralect/app/(rooms)/api/guest/messages/stream/route.ts`

Moments:

- User submits (text and/or attachments, depending on guest support).
- Client checks local state/hydration and triggers the submit hook.
- Server enforces quota and streams `text/plain` chunks.
- Client appends streamed assistant text into the local transcript.

### 3) Create chat thread (“create-room-first”)

Files:

- UI: `paralect/domains/chat/room/components/NewRoomComposer.tsx`
- Orchestration: `paralect/domains/chat/room/hooks/useNewRoomSubmit.ts`
- Create-room API: `paralect/app/(rooms)/api/rooms/route.ts` (`POST /api/rooms`)
- Server mutation: `paralect/domains/chat/room/services/roomMutations.ts` (`createRoomMutation`)
- Client fetcher: `paralect/domains/chat/room/queries/clientChatFetchers.ts` (`clientCreateRoom`)
- Schema: `paralect/domains/chat/room/schemas/rooms.ts` (`createRoomSchema`)

Moments:

1. **Derive title + model** from the first message draft (fallback titles are used for empty/image/document-first).
2. **Create room** via `clientCreateRoom` → `POST /api/rooms` and receive `roomId`.
3. **Pre-seed TanStack Query** caches (`chatKeys.room(roomId)` stub and joined rooms list).
4. **Upload attachments** (if any) via `POST /api/uploads/chat-attachment`, with `roomId` so storage paths are `{ownerId}/{roomId}/{messageId}/...`.
5. **Start streaming send** via `useSendMessage().mutate(...)` (does not await the stream).
6. **Navigate** to `router.push(/rooms/${roomId})` while streaming continues.

Failure moment:

- If uploads fail *after* room creation, `useNewRoomSubmit` deletes the empty room (`DELETE /api/rooms/:roomId`) and stays on `/`.

### 4) Thread page SSR/hydration (and the “don’t clobber optimistic streaming” rule)

Files:

- Route: `paralect/app/(rooms)/rooms/[id]/page.tsx`
- Client shell: `paralect/domains/chat/room/components/RoomClient.tsx`
- Queries: `paralect/domains/chat/room/queries/useRooms.ts`, `paralect/domains/chat/room/queries/useMessages.ts`

Moments:

- Server fetches room + profile and hydrates query cache.
- **If `room.lastMessageAt == null`** (brand-new thread), the page **skips** messages prefetch so the hydration boundary does not replace in-flight optimistic messages with an empty server snapshot.
- Missing-room is handled by rendering `RoomClient` and letting `useRoom` surface error/retry UI rather than hard `notFound()` on the server fetch alone.

### 5) Send message (authenticated): optimistic UI → streaming → persistence → invalidation

Files:

- UI: `paralect/domains/chat/room/components/ChatInput.tsx`
- Mutation: `paralect/domains/chat/room/mutations/useSendMessage.ts`
- Optimistic cache helpers: `paralect/domains/chat/room/queries/messagesCache.ts`
- Streaming API route: `paralect/app/(rooms)/api/rooms/[roomId]/messages/stream/route.ts`
- Stream DB repository: `paralect/domains/chat/streaming/server/messageStreamRepository.ts`

Client moments:

1. User submits from `ChatInput`.
2. `useSendMessage` immediately appends:
   - an optimistic **user** message
   - an optimistic **assistant placeholder**
3. Mutation POSTs to the streaming route and starts reading `response.body`.
4. As chunks arrive, the assistant text is updated (batched to at most once per animation frame; optional pacing via `NEXT_PUBLIC_CHAT_PACING`).
5. On completion:
   - mark both messages as `success`
   - invalidate `chatKeys.messages(roomId)` (refresh from DB)
   - invalidate `chatKeys.joinedRooms(userId)` (sidebar ordering via `last_message_at`)

Server moments (streaming endpoint):

- Validate JSON + required fields (reject invalid JSON with `400`).
- Request contract:
  - Endpoint: `POST /api/rooms/:roomId/messages/stream`
  - Required: `assistantId: string`
  - Optional: `modelSlug?: string` (valid slug overrides `chat_room.model_slug` for this request)
  - Optional: `mode?: "user_and_assistant" | "assistant_only"` (defaults to `user_and_assistant`)
    - `user_and_assistant` requires:
      - `id: string` (user message id)
      - `text: string` (may be blank only when `attachments.length > 0`)
      - `attachments?: Array<{ id: string; kind: "image" | "document"; storagePath: string; mimeType: string; sizeBytes: number; width?: number; height?: number; originalName?: string }>`
    - `assistant_only` requires:
      - `userMessageId: string` (existing user message to reply to)
- Auth + ownership:
  - unauthenticated → `401`
  - non-owned room → `404 Chat not found`
- Determine `modelSlug`:
  - request override `modelSlug?` wins when valid
  - else fall back to `chat_room.model_slug`
  - unsupported slug → `400`
- Build AI prompt from **persisted** history:
  - `message` rows ordered `created_at asc`
  - `message_attachment` rows ordered `created_at asc`
- Persistence rules:
  - `mode: "user_and_assistant"` inserts the user message first (and attachments), then streams, then inserts assistant message.
  - `mode: "assistant_only"` streams + inserts only assistant message for an already persisted user message.
  - Always updates `chat_room.last_message_at`.
- Response contract:
  - `Content-Type: text/plain; charset=utf-8`
  - `Cache-Control: no-store`, `X-Accel-Buffering: no`, `Content-Encoding: none`
- Failure moment:
  - provider failures still result in a persisted assistant message and readable streamed error text (avoid `controller.error(...)` → “Failed to fetch”).

### 6) Refresh mid-stream recovery: `assistant_only`

Files:

- Auto recovery: `paralect/domains/chat/streaming/hooks/useAutoStreamAssistantReply.ts`
- Streaming mutation: `paralect/domains/chat/streaming/mutations/useStreamAssistantReply.ts`
- `assistant_only` contract: `paralect/app/(rooms)/api/rooms/[roomId]/messages/stream/route.ts`

Moments:

- If the newest persisted message is a **user** message but the assistant reply is missing (common after refresh mid-stream), `RoomClient` triggers streaming in `assistant_only` mode referencing the latest user message id.
- The assistant placeholder is optimistic, then updated from streamed text; on success, invalidate `chatKeys.messages(roomId)`.

### 7) Attachments: images + documents (upload → persist → render)

Files:

- Pending images: `paralect/domains/chat/attachments/hooks/usePendingChatImages.ts`
- Pending documents:
  - `paralect/domains/chat/attachments/hooks/usePendingChatDocuments.ts`
  - `paralect/domains/chat/attachments/lib/chatDocuments.ts`
- Upload API: `paralect/app/(rooms)/api/uploads/chat-attachment/route.ts`
- Stream attachment normalization: `paralect/domains/chat/streaming/lib/streamIncomingAttachments.ts`
- Render route: `paralect/app/(rooms)/api/rooms/[roomId]/attachments/[attachmentId]/route.ts`
- Messages API includes attachments:
  - `paralect/app/(rooms)/api/rooms/[roomId]/messages/route.ts`
  - `paralect/domains/chat/room/queries/clientChatFetchers.ts`

Moments:

- Client enforces constraints at the boundary where files enter the system (max count/size; paste handler only intercepts when images exist).
- Upload:
  - Client calls `POST /api/uploads/chat-attachment` which uploads to private bucket `chat-attachments`.
  - Storage path convention:
    - `{ownerId}/{roomId}/{messageId}/...` (preferred when `roomId` is known)
    - `{ownerId}/tmp/{messageId}/...` (legacy/optional when `roomId` omitted)
- Stream request includes attachments with `storagePath`; server normalizes and persists rows in `public.message_attachment`.
- Render:
  - UI uses `GET /api/rooms/:roomId/attachments/:attachmentId` which checks ownership and redirects to a short-lived signed URL.

Document-specific moments:

- Document text is extracted server-side from Storage and stored in `message_attachment.extracted_text` / `extracted_chars`.
- Context is trimmed with hard caps:
  - 12k chars per document
  - 24k chars total per message across documents

### 7.1) Thread UX moments (scroll, load-more, grouping)

Files:

- `paralect/domains/chat/room/components/RoomClient.tsx`

Moments:

- Scroll management uses a normal top-to-bottom list (no `flex-col-reverse`):
  - initial load: scroll to bottom instantly
  - new message: scroll to bottom only if the user is already near the bottom
  - older-message load: preserve scroll position by saving/restoring scroll height/top
- Load-more uses an intersection observer sentinel at the top.
- Grouping collapses avatar/name when the same author posts within a short window; assistant rows use `author_id = null`.

### 8) Model selection & vision behavior

Files:

- Route: `paralect/app/(rooms)/api/rooms/[roomId]/messages/stream/route.ts`
- Model registry: `paralect/shared/lib/ai/model-registry.ts`
- Provider resolution: `paralect/shared/lib/ai/providers.ts`
- Server env validation: `paralect/shared/lib/ai/env.ts`

Moments:

- The streaming route accepts optional `modelSlug` to override the room default for this request (validated via `isAiModelSlug`).
- Vision vs non-vision:
  - OpenAI/Google models: include images as image parts (signed URLs).
  - Non-vision models: include a short text note that images were attached.

### 9) Delete a chat thread (room)

Files:

- HTTP: `paralect/app/(rooms)/api/rooms/[roomId]/route.ts` (`DELETE /api/rooms/:roomId`)
- Server: `paralect/domains/chat/room/services/roomMutations.ts` (`deleteRoomMutation`)
- Hook: `paralect/domains/chat/room/mutations/useDeleteRoom.ts`
- UI: `paralect/domains/chat/room/components/ChatSidebarClient.tsx`

Moments:

- User deletes via sidebar row actions.
- If deleting the currently active room, client does `router.replace("/")` before optimistic removal (route state stays consistent).
- On success:
  - invalidate room lists and related message caches
  - broadcast cross-tab invalidation
  - show toast

### 10) Cross-tab sync (BroadcastChannel invalidation)

Files:

- Broadcast + listener: `paralect/shared/lib/query/chatCrossTabSync.ts`
- Listener registration: `paralect/shared/lib/query/QueryProvider.tsx`
- Broadcast callers:
  - `paralect/domains/chat/room/mutations/useSendMessage.ts`
  - `paralect/domains/chat/streaming/mutations/useStreamAssistantReply.ts`
  - `paralect/domains/chat/room/mutations/useDeleteRoom.ts`
  - `paralect/domains/chat/room/mutations/useUpdateRoomModel.ts`
  - `paralect/domains/chat/room/mutations/useCreateRoom.ts` (hook-based create flows)

Moments:

- Mutations broadcast lightweight “invalidate” events.
- Other tabs listen and invalidate relevant queries (rooms + room + messages), triggering refetch.
- Queries also use `refetchOnWindowFocus: true` as a backstop (missed broadcasts still recover on focus).

## File map (all chat-related code paths)

### Rules / documentation

- `paralect/.cursor/rules/features/features-chat.md`: internal “source of truth” map.
- `paralect/docs/chat-how-it-works.md`: this doc.

### Layout / shell / sidebar

- `paralect/app/(rooms)/layout.tsx`
- `paralect/domains/chat/room/components/ChatLayoutShell.tsx`
- `paralect/domains/chat/room/components/ChatSidebar.tsx`
- `paralect/domains/chat/room/components/ChatSidebarClient.tsx`

### Guest chat (logged-out)

- `paralect/domains/chat/guest/components/GuestChat.tsx`
- `paralect/domains/chat/guest/hooks/useGuestChatSubmit.ts`
- `paralect/domains/chat/guest/hooks/useGuestChatStorage.ts`
- `paralect/domains/chat/guest/hooks/useClientHydrated.ts`
- `paralect/domains/chat/guest/hooks/useGuestQuota.ts`
- `paralect/domains/chat/guest/lib/guestQuotaConstants.ts`
- `paralect/app/(rooms)/api/guest/messages/stream/route.ts`

### Rooms (threads) + messages queries

- Rooms queries/types: `paralect/domains/chat/room/queries/useRooms.ts`, `paralect/domains/chat/room/queries/room-fetchers.ts`
- Messages pagination: `paralect/domains/chat/room/queries/message-pagination.ts`
- Messages query: `paralect/domains/chat/room/queries/useMessages.ts`
- Client fetchers: `paralect/domains/chat/room/queries/clientChatFetchers.ts`
- Messages API: `paralect/app/(rooms)/api/rooms/[roomId]/messages/route.ts`

### Streaming (auth threads)

- Route: `paralect/app/(rooms)/api/rooms/[roomId]/messages/stream/route.ts`
- Repository: `paralect/domains/chat/streaming/server/messageStreamRepository.ts`
- Recovery hooks:
  - `paralect/domains/chat/streaming/hooks/useAutoStreamAssistantReply.ts`
  - `paralect/domains/chat/streaming/mutations/useStreamAssistantReply.ts`

### Composer + send mutation

- Input UI: `paralect/domains/chat/room/components/ChatInput.tsx`
- Send mutation: `paralect/domains/chat/room/mutations/useSendMessage.ts`
- Optimistic helpers: `paralect/domains/chat/room/queries/messagesCache.ts`

### Create/delete rooms

- Create room UI/hook: `paralect/domains/chat/room/components/NewRoomComposer.tsx`, `paralect/domains/chat/room/hooks/useNewRoomSubmit.ts`
- Create/delete routes:
  - `paralect/app/(rooms)/api/rooms/route.ts` (`POST /api/rooms`)
  - `paralect/app/(rooms)/api/rooms/[roomId]/route.ts` (`DELETE /api/rooms/:roomId`)
- Server mutations: `paralect/domains/chat/room/services/roomMutations.ts`
- Delete hook: `paralect/domains/chat/room/mutations/useDeleteRoom.ts`

### Attachments (upload + normalize + render)

- Pending images: `paralect/domains/chat/attachments/hooks/usePendingChatImages.ts`
- Pending documents: `paralect/domains/chat/attachments/hooks/usePendingChatDocuments.ts`
- Upload route: `paralect/app/(rooms)/api/uploads/chat-attachment/route.ts`
- Stream normalize: `paralect/domains/chat/streaming/lib/streamIncomingAttachments.ts`
- Render route: `paralect/app/(rooms)/api/rooms/[roomId]/attachments/[attachmentId]/route.ts`

### Cross-tab sync

- `paralect/shared/lib/query/chatCrossTabSync.ts`
- `paralect/shared/lib/query/QueryProvider.tsx`

### AI models/providers (server-only)

- `paralect/shared/lib/ai/model-registry.ts`
- `paralect/shared/lib/ai/providers.ts`
- `paralect/shared/lib/ai/env.ts`

