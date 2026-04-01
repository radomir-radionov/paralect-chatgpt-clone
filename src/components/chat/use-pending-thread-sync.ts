import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { fetchChatDetailPage } from "@/lib/chat-api";
import { isChatNotFoundError } from "@/lib/chat-error";

export function usePendingThreadSync(options: {
  effectiveChatId: string | undefined;
  shouldSyncPendingThread: boolean;
  chatDetailNotFound: boolean;
  queryClient: QueryClient;
  router: { replace: (href: string) => void };
}) {
  const {
    effectiveChatId,
    shouldSyncPendingThread,
    chatDetailNotFound,
    queryClient,
    router,
  } = options;

  useEffect(() => {
    if (!effectiveChatId || !shouldSyncPendingThread || chatDetailNotFound) return;

    let cancelled = false;
    let attempts = 0;

    const syncThread = async () => {
      if (cancelled || attempts >= 5) return;
      attempts += 1;
      try {
        await queryClient.fetchInfiniteQuery({
          queryKey: ["chat", effectiveChatId],
          initialPageParam: undefined as string | undefined,
          queryFn: ({ pageParam }) =>
            fetchChatDetailPage(
              effectiveChatId,
              pageParam ? { before: pageParam } : {},
            ),
        });
        if (cancelled) return;
      } catch (error) {
        if (cancelled) return;
        if (isChatNotFoundError(error)) {
          queryClient.removeQueries({ queryKey: ["chat", effectiveChatId] });
          router.replace("/chat");
          return;
        }
        console.error(error);
      }
    };

    void syncThread();
    const intervalId = window.setInterval(() => {
      void syncThread();
    }, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    effectiveChatId,
    queryClient,
    router,
    shouldSyncPendingThread,
    chatDetailNotFound,
  ]);
}

