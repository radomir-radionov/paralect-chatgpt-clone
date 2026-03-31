import type { QueryClient } from "@tanstack/react-query";
import { invalidateChatsListDebounced } from "@/lib/invalidate-chats-list";

type ReconcileAuthChatAfterStreamOptions = {
  queryClient: QueryClient;
};

export function reconcileAuthChatAfterStream({
  queryClient,
}: ReconcileAuthChatAfterStreamOptions): void {
  invalidateChatsListDebounced(queryClient);
}
