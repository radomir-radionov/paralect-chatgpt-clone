import type { AiModelSlug } from "@shared/lib/ai/model-registry";

import type {
  MessageAttachment,
  MessageStatus,
} from "@domains/chat/types/chat.types";

const STORAGE_KEY = "paralect_guest_chat";

export type GuestMessage = {
  id: string;
  text: string;
  created_at: string;
  role: "assistant" | "user";
  attachments?: MessageAttachment[];
  status?: MessageStatus;
};

export type StoredGuestChat = {
  messages?: GuestMessage[];
  modelSlug?: AiModelSlug;
};

export const EMPTY_GUEST_MESSAGES: ReadonlyArray<GuestMessage> = [];

const guestChatListeners = new Set<() => void>();

export function subscribeGuestChat(callback: () => void) {
  guestChatListeners.add(callback);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    guestChatListeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function getGuestChatSnapshot(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function getGuestChatServerSnapshot(): string | null {
  return null;
}

export function parseStoredGuestChat(raw: string | null): StoredGuestChat | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredGuestChat> & {
      remaining?: unknown;
      [key: string]: unknown;
    };

    return {
      ...(Array.isArray(parsed.messages) ? { messages: parsed.messages } : {}),
      ...(typeof parsed.modelSlug === "string"
        ? { modelSlug: parsed.modelSlug as AiModelSlug }
        : {}),
    };
  } catch {
    return null;
  }
}

export function updateStoredGuestChat(
  updater: (prev: StoredGuestChat) => StoredGuestChat,
) {
  if (typeof window === "undefined") return;

  const prev =
    parseStoredGuestChat(window.localStorage.getItem(STORAGE_KEY)) ?? {};
  const next = updater(prev);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  for (const cb of guestChatListeners) cb();
}
