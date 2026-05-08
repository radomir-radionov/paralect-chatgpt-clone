"use client";

import { useMemo, useSyncExternalStore } from "react";

import {
  AI_MODELS,
  DEFAULT_AI_MODEL_SLUG,
  type AiModelSlug,
} from "@shared/lib/ai/model-registry";

import {
  EMPTY_GUEST_MESSAGES,
  getGuestChatServerSnapshot,
  getGuestChatSnapshot,
  parseStoredGuestChat,
  subscribeGuestChat,
  updateStoredGuestChat,
  type GuestMessage,
} from "@domains/chat/guest/lib/guestChatLocalStorage";

export function useGuestChatStorage() {
  const storedRaw = useSyncExternalStore(
    subscribeGuestChat,
    getGuestChatSnapshot,
    getGuestChatServerSnapshot,
  );

  const stored = useMemo(() => parseStoredGuestChat(storedRaw), [storedRaw]);

  const messages = (stored?.messages ?? EMPTY_GUEST_MESSAGES) as GuestMessage[];
  const modelSlug: AiModelSlug =
    stored?.modelSlug &&
    AI_MODELS.some((model) => model.slug === stored.modelSlug)
      ? stored.modelSlug
      : DEFAULT_AI_MODEL_SLUG;

  const setModelSlug = (next: AiModelSlug) => {
    updateStoredGuestChat((prev) => ({ ...prev, modelSlug: next }));
  };

  return {
    messages,
    modelSlug,
    setModelSlug,
    updateStoredGuestChat,
  };
}
