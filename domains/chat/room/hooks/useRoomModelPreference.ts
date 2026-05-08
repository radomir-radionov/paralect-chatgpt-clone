"use client";

import { useCallback, useMemo, useState } from "react";

import {
  type AiModelSlug,
  AI_MODELS,
  DEFAULT_AI_MODEL_SLUG,
} from "@shared/lib/ai/model-registry";

function readPersistedModelSlug(storageKey: string): AiModelSlug | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    if (AI_MODELS.some((m) => m.slug === raw)) {
      return raw as AiModelSlug;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Per-room model override: in-memory (SPA navigation), then localStorage, then server value.
 * `streamSlug` may be undefined when nothing is known yet; `uiSlug` always falls back to default.
 */
export function useRoomModelPreference(
  roomId: string,
  serverModelSlug: AiModelSlug | undefined | null,
) {
  const storageKey = useMemo(
    () => `paralect_room_model_override:${roomId}`,
    [roomId],
  );
  const persistedSlug = useMemo(
    () => readPersistedModelSlug(storageKey),
    [storageKey],
  );
  const [byRoomId, setByRoomId] = useState<Record<string, AiModelSlug>>(() => ({}));

  const streamSlug =
    byRoomId[roomId] ?? persistedSlug ?? serverModelSlug ?? undefined;
  const uiSlug = streamSlug ?? DEFAULT_AI_MODEL_SLUG;

  const setModelSlug = useCallback(
    (next: AiModelSlug) => {
      setByRoomId((prev) => ({ ...prev, [roomId]: next }));
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // ignore
      }
    },
    [roomId, storageKey],
  );

  return { uiSlug, streamSlug, setModelSlug };
}
