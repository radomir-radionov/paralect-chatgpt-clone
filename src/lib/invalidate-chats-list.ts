import type { QueryClient } from "@tanstack/react-query";

const DEBOUNCE_MS = 80;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Coalesces rapid successive invalidations of the sidebar chats list (e.g. realtime
 * `chat_created` plus `reconcileAuthChatAfterStream` after the first message) into one refetch.
 */
export function invalidateChatsListDebounced(queryClient: QueryClient): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void queryClient.invalidateQueries({ queryKey: ["chats"] });
  }, DEBOUNCE_MS);
}
