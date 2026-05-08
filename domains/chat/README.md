# Chat domain

This folder is the **chat bounded context**: domain-first layout (group by business area, then by capability or technical role).

## Top-level areas

| Folder | Purpose |
| --- | --- |
| `attachments/` | Shared attachment handling (documents, images, parsing). Used by authenticated UI, streaming pipeline, and guest APIs. |
| `streaming/` | Assistant reply streaming (client hooks, stream parsing, server-side stream helpers). |
| `guest/` | **Guest-only** unauthenticated chat (UI, quota, local storage, guest API helpers). |
| `room/` | **Signed-in** chat: `room/components`, `room/hooks`, `room/queries`, `room/mutations`, `room/api`, `room/services`, `room/context`, `room/schemas` (rooms, sidebar, composer for authenticated users). |
| `types/` | Shared TypeScript types used by guest, room, and streaming (e.g. `Message`, `CachedMessage`). |

Keep **`attachments`**, **`guest`**, and **`streaming`** as separate top-level siblings under `chat/` (do not fold them under one umbrella folder). Authenticated UI and data access live under **`room/`**, not at the `chat/` root.

## Where to put new code

- **Guest-specific** (only runs on the public guest path): `guest/` (`guest/components`, `guest/hooks`, `guest/lib`, …).
- **Signed-in chat** (rooms, sidebar, composer for logged-in users): under `room/` (`room/components`, `room/hooks`, `room/queries`, …).
- **Attachment rules / pending uploads** reused by both modes: `attachments/`.
- **Stream transport and assistant streaming orchestration**: `streaming/`.

Dependency direction is roughly: `guest` → `streaming` → `attachments` for streaming flows; authenticated UI imports the same `streaming` and `attachments` modules as needed.
