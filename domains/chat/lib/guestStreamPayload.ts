const MAX_GUEST_HISTORY_MESSAGES = 20;
const MAX_GUEST_MESSAGE_LENGTH = 2000;

export type GuestChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type GuestStreamRequestV1 = {
  modelSlug: string;
  messages: GuestChatMessage[];
};

export type GuestStreamRequestV2 = {
  modelSlug: string;
  text: string;
  history?: GuestChatMessage[];
};

function normalizeMessages(value: unknown): GuestChatMessage[] | null {
  if (!Array.isArray(value)) return null;

  const messages: GuestChatMessage[] = [];

  for (const item of value) {
    if (typeof item !== "object" || item == null) return null;

    const raw = item as Record<string, unknown>;
    const role = raw.role;
    const text = raw.text;

    if (role !== "user" && role !== "assistant") return null;
    if (typeof text !== "string") return null;
    if (text.length > MAX_GUEST_MESSAGE_LENGTH) return null;

    const trimmed = text.trim();
    if (!trimmed) return null;

    messages.push({ role, text: trimmed });
  }

  return messages;
}

export function parseGuestMessagesForStream(body: Record<string, unknown>) {
  // v2: { text, history? } (backwards-compatible, but not used by the current UI yet)
  if (typeof body.text === "string") {
    const text = body.text.trim();
    if (!text) return null;
    if (text.length > MAX_GUEST_MESSAGE_LENGTH) return null;

    const history = body.history == null ? [] : normalizeMessages(body.history);
    if (history == null) return null;

    const combined = [...history, { role: "user" as const, text }];
    // Ensure we don't exceed the same history cap as v1 (including the new user message).
    return combined.slice(-MAX_GUEST_HISTORY_MESSAGES);
  }

  // v1 (current): { messages }
  const messages = normalizeMessages(body.messages);
  if (messages == null) return null;
  if (messages.length === 0) return null;
  if (messages[messages.length - 1]?.role !== "user") return null;

  return messages.slice(-MAX_GUEST_HISTORY_MESSAGES);
}

